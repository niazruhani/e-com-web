import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { calculateSubtotal, calculateTax } from "@/lib/pricing";
import { checkoutFingerprint } from "@/lib/checkout-fingerprint";

const divisions = [
  "Barishal",
  "Chattogram",
  "Dhaka",
  "Khulna",
  "Mymensingh",
  "Rajshahi",
  "Rangpur",
  "Sylhet",
] as const;

const checkoutLineSchema = z.object({
  productId: z.string().min(1).max(64),
  size: z.string().trim().min(1).max(32),
  quantity: z.number().int().min(1).max(20),
});

export const checkoutSchema = z.object({
  idempotencyKey: z.uuid(),
  items: z.array(checkoutLineSchema).min(1).max(50),
  email: z.email().trim().max(254),
  phone: z.string().trim().regex(/^(?:\+?880|0)1[3-9]\d{8}$/),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  address: z.string().trim().min(4).max(200),
  division: z.enum(divisions),
  district: z.string().trim().min(2).max(100),
  area: z.string().trim().min(2).max(100),
  postalCode: z.string().regex(/^\d{4}$/),
  note: z.string().trim().max(500).optional(),
  paymentMethod: z.enum(["COD", "SSLCOMMERZ"]),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export class CheckoutError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

function configuredPaisa(name: string) {
  const value = process.env[name];
  if (!value || !/^\d+$/.test(value)) {
    throw new CheckoutError(
      `Checkout is unavailable until ${name} is configured.`,
      503,
      "CHECKOUT_NOT_CONFIGURED",
    );
  }
  const amount = Number(value);
  if (!Number.isSafeInteger(amount)) {
    throw new CheckoutError(`${name} must be a safe integer in paisa.`, 503, "CHECKOUT_NOT_CONFIGURED");
  }
  return amount;
}

function getCheckoutPolicy() {
  if (
    process.env.BUSINESS_POLICIES_CONFIRMED !== "true" ||
    (!process.env.SUPPORT_EMAIL && !process.env.SUPPORT_PHONE)
  ) {
    throw new CheckoutError(
      "Checkout is unavailable until business contact details and reviewed customer policies are published.",
      503,
      "BUSINESS_SETUP_REQUIRED",
    );
  }
  const taxRateBps = configuredPaisa("TAX_RATE_BPS");
  if (taxRateBps > 10_000) {
    throw new CheckoutError("TAX_RATE_BPS cannot exceed 10000.", 503, "CHECKOUT_NOT_CONFIGURED");
  }
  return {
    dhakaDeliveryPaisa: configuredPaisa("DELIVERY_FEE_DHAKA_PAISE"),
    outsideDhakaDeliveryPaisa: configuredPaisa("DELIVERY_FEE_OUTSIDE_DHAKA_PAISE"),
    freeDeliveryThresholdPaisa: configuredPaisa("FREE_DELIVERY_THRESHOLD_PAISE"),
    taxRateBps,
  };
}

function mergeLines(items: CheckoutInput["items"]) {
  const quantities = new Map<string, number>();
  for (const item of items) {
    const key = `${item.productId}\u0000${item.size}`;
    const quantity = (quantities.get(key) ?? 0) + item.quantity;
    if (quantity > 20) {
      throw new CheckoutError("A product option cannot exceed 20 items per order.", 400, "INVALID_QUANTITY");
    }
    quantities.set(key, quantity);
  }
  return [...quantities].map(([key, quantity]) => {
    const [productId, size] = key.split("\u0000");
    return { productId, size, quantity };
  });
}

export async function createOrder(input: CheckoutInput, userId: string | null) {
  const policy = getCheckoutPolicy();
  if (!process.env.DATABASE_URL) {
    throw new CheckoutError("Order processing is not configured.", 503, "CHECKOUT_NOT_CONFIGURED");
  }

  const lines = mergeLines(input.items);
  const fingerprint = checkoutFingerprint({ ...input, items: lines }, userId);
  const prior = await prisma.order.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: {
      id: true,
      number: true,
      totalPaisa: true,
      paymentProvider: true,
      status: true,
      checkoutFingerprint: true,
    },
  });
  if (prior) {
    if (prior.checkoutFingerprint !== fingerprint) {
      throw new CheckoutError(
        "This checkout key has already been used with different order details.",
        409,
        "IDEMPOTENCY_KEY_REUSED",
      );
    }
    return { ...prior, reused: true };
  }
  const orderNumber = `DF-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const online = input.paymentMethod === "SSLCOMMERZ";
  if (
    online &&
    (!process.env.SSLCOMMERZ_STORE_ID ||
      !process.env.SSLCOMMERZ_STORE_PASSWORD ||
      !["sandbox", "production"].includes(process.env.SSLCOMMERZ_MODE ?? ""))
  ) {
    throw new CheckoutError("Online payment is unavailable until SSLCommerz is configured.", 503, "PAYMENT_NOT_CONFIGURED");
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const items = [];
        for (const line of lines) {
          const variant = await tx.productVariant.findFirst({
            where: {
              productId: line.productId,
              size: line.size,
              active: true,
              product: {
                is: {
                  status: "ACTIVE",
                  ...(process.env.NODE_ENV === "production" ? { isDemo: false } : {}),
                },
              },
            },
            include: { product: { include: { category: true } } },
          });
          if (!variant) {
            throw new CheckoutError("One or more selected items are unavailable.", 409, "ITEM_UNAVAILABLE");
          }
          if (variant.stock < line.quantity) {
            throw new CheckoutError(
              `${variant.product.name} (${line.size}) has only ${variant.stock} available.`,
              409,
              "INSUFFICIENT_STOCK",
            );
          }

          const changed = await tx.productVariant.updateMany({
            where: { id: variant.id, active: true, stock: { gte: line.quantity } },
            data: { stock: { decrement: line.quantity } },
          });
          if (changed.count !== 1) {
            throw new CheckoutError("Stock changed while placing the order. Please review your bag.", 409, "STOCK_CONFLICT");
          }

          const unitPricePaisa = variant.pricePaisa ?? variant.product.pricePaisa;
          items.push({
            productId: variant.productId,
            variantId: variant.id,
            productName: variant.product.name,
            sku: variant.sku,
            variantSnapshot: {
              size: variant.size,
              color: variant.color,
              options: variant.options,
            },
            unitPricePaisa,
            quantity: line.quantity,
          });

          await tx.inventoryMovement.create({
            data: {
              variantId: variant.id,
              quantity: -line.quantity,
              reason: "ORDER_RESERVATION",
              reference: orderNumber,
            },
          });
        }

        const subtotalPaisa = calculateSubtotal(
          items.map((item) => ({ unitPrice: item.unitPricePaisa, quantity: item.quantity })),
        );
        const shippingPaisa =
          subtotalPaisa >= policy.freeDeliveryThresholdPaisa
            ? 0
            : input.division === "Dhaka"
              ? policy.dhakaDeliveryPaisa
              : policy.outsideDhakaDeliveryPaisa;
        const taxPaisa = calculateTax(subtotalPaisa, policy.taxRateBps);
        const totalPaisa = subtotalPaisa + shippingPaisa + taxPaisa;
        if (!Number.isSafeInteger(totalPaisa)) {
          throw new CheckoutError("The order total is outside the supported range.", 400, "INVALID_TOTAL");
        }

        const order = await tx.order.create({
          data: {
            number: orderNumber,
            idempotencyKey: input.idempotencyKey,
            checkoutFingerprint: fingerprint,
            userId,
            guestEmail: input.email,
            phone: input.phone,
            addressSnapshot: {
              firstName: input.firstName,
              lastName: input.lastName,
              address: input.address,
              division: input.division,
              district: input.district,
              area: input.area,
              postalCode: input.postalCode,
            },
            subtotalPaisa,
            shippingPaisa,
            taxPaisa,
            totalPaisa,
            paymentProvider: input.paymentMethod,
            reservationExpiresAt: online ? new Date(Date.now() + 15 * 60 * 1000) : null,
            customerNote: input.note,
            items: { create: items },
            payment: {
              create: {
                provider: input.paymentMethod,
                amountPaisa: totalPaisa,
              },
            },
          },
          select: { id: true, number: true, totalPaisa: true, paymentProvider: true, status: true },
        });
        return { ...order, reused: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2002" || error.code === "P2034")
    ) {
      const retry = await prisma.order.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        select: {
          id: true,
          number: true,
          totalPaisa: true,
          paymentProvider: true,
          status: true,
          checkoutFingerprint: true,
        },
      });
      if (retry) {
        if (retry.checkoutFingerprint !== fingerprint) {
          throw new CheckoutError(
            "This checkout key has already been used with different order details.",
            409,
            "IDEMPOTENCY_KEY_REUSED",
          );
        }
        return { ...retry, reused: true };
      }
      throw new CheckoutError("Stock changed during checkout. Please retry.", 409, "CHECKOUT_CONFLICT");
    }
    throw error;
  }
}
