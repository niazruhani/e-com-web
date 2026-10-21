import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { CheckoutError } from "@/lib/checkout";

function sslcommerzBaseUrl() {
  const mode = process.env.SSLCOMMERZ_MODE;
  if (mode === "sandbox") return "https://sandbox.sslcommerz.com";
  if (mode === "production") return "https://securepay.sslcommerz.com";
  throw new CheckoutError("Set SSLCOMMERZ_MODE to sandbox or production.", 503, "PAYMENT_NOT_CONFIGURED");
}

function getPublicOrigin() {
  const raw = process.env.AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) throw new CheckoutError("Set AUTH_URL to the public application URL.", 503, "PAYMENT_NOT_CONFIGURED");
  const url = new URL(raw);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new CheckoutError("Online payments require an HTTPS AUTH_URL.", 503, "PAYMENT_NOT_CONFIGURED");
  }
  return url.origin;
}

function paisaAsDecimal(amountPaisa: number) {
  return `${Math.floor(amountPaisa / 100)}.${String(amountPaisa % 100).padStart(2, "0")}`;
}

function parseDecimalPaisa(value: unknown) {
  if (typeof value !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount) ? amount : null;
}

function isAllowedGatewayUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      ["sandbox.sslcommerz.com", "securepay.sslcommerz.com"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

export async function initiateSslcommerz(orderId: string) {
  const storeId = process.env.SSLCOMMERZ_STORE_ID;
  const storePassword = process.env.SSLCOMMERZ_STORE_PASSWORD;
  if (!storeId || !storePassword) {
    throw new CheckoutError("SSLCommerz credentials are not configured.", 503, "PAYMENT_NOT_CONFIGURED");
  }
  const base = sslcommerzBaseUrl();
  const origin = getPublicOrigin();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, payment: true },
  });
  if (!order || order.paymentProvider !== "SSLCOMMERZ" || !order.payment) {
    throw new CheckoutError("Payment order could not be found.", 404, "ORDER_NOT_FOUND");
  }
  if (order.status !== "PENDING" || order.paymentStatus !== "PENDING" || order.payment.status !== "PENDING") {
    throw new CheckoutError("This order is no longer awaiting payment.", 409, "PAYMENT_NOT_PENDING");
  }
  if (order.payment.amountPaisa !== order.totalPaisa || order.payment.currency !== "BDT") {
    throw new CheckoutError("The payment amount does not match the order.", 409, "PAYMENT_MISMATCH");
  }
  if (order.payment.providerCheckoutUrl) return order.payment.providerCheckoutUrl;

  const claim = randomUUID();
  const now = new Date();
  const staleClaimBefore = new Date(now.getTime() - 30_000);
  const claimed = await prisma.payment.updateMany({
    where: {
      orderId: order.id,
      status: "PENDING",
      providerCheckoutUrl: null,
      OR: [
        { providerSessionClaim: null },
        { providerSessionClaimedAt: { lt: staleClaimBefore } },
      ],
    },
    data: { providerSessionClaim: claim, providerSessionClaimedAt: now },
  });
  if (claimed.count !== 1) {
    const current = await prisma.payment.findUnique({ where: { orderId: order.id } });
    if (current?.providerCheckoutUrl) return current.providerCheckoutUrl;
    throw new CheckoutError(
      "The payment session is still being prepared. Please retry shortly.",
      409,
      "PAYMENT_SESSION_PENDING",
    );
  }

  try {
    const address = order.addressSnapshot as {
      firstName: string;
      lastName: string;
      address: string;
      division: string;
      district: string;
      postalCode: string;
    };
    const form = new URLSearchParams({
      store_id: storeId,
      store_passwd: storePassword,
      total_amount: paisaAsDecimal(order.totalPaisa),
      currency: "BDT",
      tran_id: order.number,
      success_url: `${origin}/api/payments/sslcommerz/return`,
      fail_url: `${origin}/api/payments/sslcommerz/return`,
      cancel_url: `${origin}/api/payments/sslcommerz/return`,
      ipn_url: `${origin}/api/payments/sslcommerz/ipn`,
      shipping_method: "YES",
      product_name: order.items.map((item) => item.productName).join(", ").slice(0, 200),
      product_category: "general",
      product_profile: "general",
      cus_name: `${address.firstName} ${address.lastName}`.slice(0, 80),
      cus_email: order.guestEmail,
      cus_add1: address.address.slice(0, 150),
      cus_city: address.district.slice(0, 50),
      cus_postcode: address.postalCode,
      cus_country: "Bangladesh",
      cus_phone: order.phone,
      ship_name: `${address.firstName} ${address.lastName}`.slice(0, 80),
      ship_add1: address.address.slice(0, 150),
      ship_city: address.district.slice(0, 50),
      ship_postcode: address.postalCode,
      ship_country: "Bangladesh",
    });

    const response = await fetch(`${base}/gwprocess/v4/api.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new CheckoutError("The payment provider did not accept the checkout request.", 502, "PAYMENT_PROVIDER_ERROR");
    }
    const result: unknown = await response.json();
    if (
      typeof result !== "object" ||
      result === null ||
      !("status" in result) ||
      result.status !== "SUCCESS" ||
      !("GatewayPageURL" in result) ||
      !isAllowedGatewayUrl(result.GatewayPageURL)
    ) {
      throw new CheckoutError("The payment provider did not return a valid hosted checkout URL.", 502, "PAYMENT_PROVIDER_ERROR");
    }

    const gatewayUrl = result.GatewayPageURL;
    const sessionKey =
      "sessionkey" in result && typeof result.sessionkey === "string" ? result.sessionkey : null;
    const stored = await prisma.payment.updateMany({
      where: { orderId: order.id, status: "PENDING", providerSessionClaim: claim },
      data: {
        providerSessionId: sessionKey,
        providerCheckoutUrl: gatewayUrl,
        providerSessionClaim: null,
        providerSessionClaimedAt: null,
      },
    });
    if (stored.count !== 1) {
      const current = await prisma.payment.findUnique({ where: { orderId: order.id } });
      if (current?.providerCheckoutUrl) return current.providerCheckoutUrl;
      throw new CheckoutError("The payment order changed before its session could be saved.", 409, "PAYMENT_SESSION_CONFLICT");
    }
    return gatewayUrl;
  } catch (error) {
    await prisma.payment.updateMany({
      where: { orderId: order.id, providerSessionClaim: claim },
      data: { providerSessionClaim: null, providerSessionClaimedAt: null },
    });
    throw error;
  }
}

export async function verifySslcommerzTransaction(valId: string) {
  const storeId = process.env.SSLCOMMERZ_STORE_ID;
  const storePassword = process.env.SSLCOMMERZ_STORE_PASSWORD;
  if (!storeId || !storePassword) {
    throw new CheckoutError("SSLCommerz credentials are not configured.", 503, "PAYMENT_NOT_CONFIGURED");
  }
  const base = sslcommerzBaseUrl();
  const query = new URLSearchParams({
    val_id: valId,
    store_id: storeId,
    store_passwd: storePassword,
    format: "json",
  });
  const response = await fetch(`${base}/validator/api/validationserverAPI.php?${query}`, {
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new CheckoutError("SSLCommerz transaction validation is temporarily unavailable.", 502, "PAYMENT_VALIDATION_ERROR");
  }
  const result: unknown = await response.json();
  if (typeof result !== "object" || result === null) {
    throw new CheckoutError("SSLCommerz returned an invalid validation response.", 502, "PAYMENT_VALIDATION_ERROR");
  }
  return result as Record<string, unknown>;
}

export function verifiedAmountPaisa(value: unknown) {
  return parseDecimalPaisa(value);
}
