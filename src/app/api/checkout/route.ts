import { z } from "zod";
import { apiError, isSameOriginMutation } from "@/lib/api";
import { CheckoutError, checkoutSchema, createOrder } from "@/lib/checkout";
import { getCurrentUser } from "@/lib/authorization";
import { consumeRateLimit, rateLimitSubject } from "@/lib/rate-limit";
import { isDatabaseConfigured } from "@/lib/db";
import { initiateSslcommerz } from "@/lib/payments/sslcommerz";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return apiError(403, "CSRF_REJECTED", "The request origin could not be verified.");
  }
  if (!isDatabaseConfigured()) {
    return apiError(503, "CHECKOUT_NOT_CONFIGURED", "Order processing is not configured.");
  }
  const limit = await consumeRateLimit("checkout", rateLimitSubject(request), 10, 60);
  if (!limit.allowed) {
    return Response.json(
      { error: { code: "RATE_LIMITED", message: "Please wait before trying checkout again." } },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "A valid JSON request body is required.");
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: { code: "VALIDATION_FAILED", message: "Check the checkout details and try again.", fields: z.flattenError(parsed.error).fieldErrors } },
      { status: 400 },
    );
  }

  try {
    const user = await getCurrentUser();
    const order = await createOrder(parsed.data, user?.id ?? null);
    const paymentUrl =
      order.paymentProvider === "SSLCOMMERZ" ? await initiateSslcommerz(order.id) : undefined;
    return Response.json(
      {
        order: {
          id: order.id,
          number: order.number,
          totalPaisa: order.totalPaisa,
          status: order.status,
          reused: order.reused,
        },
        ...(paymentUrl ? { paymentUrl } : {}),
      },
      { status: order.reused ? 200 : 201 },
    );
  } catch (error) {
    if (error instanceof CheckoutError) {
      return apiError(error.status, error.code, error.message);
    }
    throw error;
  }
}
