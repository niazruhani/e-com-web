import { z } from "zod";
import { Prisma } from "@prisma/client";
import { apiError, isSameOriginMutation } from "@/lib/api";
import { getCurrentUser, hasPermission } from "@/lib/authorization";
import { isDatabaseConfigured, prisma } from "@/lib/db";
import { canTransitionOrder } from "@/lib/order-state";

export const runtime = "nodejs";

const updateSchema = z.object({
  status: z.enum(["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"]).optional(),
  paymentCollected: z.boolean().optional(),
  carrier: z.string().trim().min(2).max(80).optional(),
  trackingNumber: z.string().trim().min(2).max(120).optional(),
}).refine((value) => value.status !== undefined || value.paymentCollected === true, {
  message: "Provide a status update or confirm COD collection.",
}).refine((value) => value.paymentCollected !== true || value.status === undefined, {
  message: "Confirm COD collection in a separate update after delivery.",
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOriginMutation(request)) return apiError(403, "CSRF_REJECTED", "The request origin could not be verified.");
  if (!isDatabaseConfigured() || !process.env.AUTH_SECRET) return apiError(503, "ADMIN_UNAVAILABLE", "Admin services are not configured.");
  const user = await getCurrentUser();
  if (!user) return apiError(401, "UNAUTHENTICATED", "Sign in to access this resource.");
  if (!hasPermission(user.role, "orders:write")) return apiError(403, "FORBIDDEN", "You do not have permission to update orders.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "A valid JSON request body is required.");
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return apiError(400, "VALIDATION_FAILED", "The order update is invalid.");
  const { id } = await context.params;
  const input = parsed.data;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({ where: { id }, include: { items: true, payment: true, shipment: true } });
        if (!order) return { kind: "not-found" as const };

        if (input.paymentCollected) {
          if (order.paymentProvider !== "COD" || order.status !== "DELIVERED" || order.paymentStatus === "PAID") {
            return { kind: "invalid-payment-state" as const };
          }
          await tx.payment.update({
            where: { orderId: order.id },
            data: { status: "PAID", verifiedAt: new Date(), transactionId: `COD-${order.number}` },
          });
          await tx.order.update({ where: { id }, data: { paymentStatus: "PAID" } });
        }

        if (input.status) {
          if (!canTransitionOrder(order.status, input.status)) return { kind: "invalid-transition" as const };
          if (order.paymentStatus === "PAID" && input.status === "CANCELLED") {
            return { kind: "refund-required" as const };
          }
          if (
            order.paymentProvider === "SSLCOMMERZ" &&
            input.status === "CONFIRMED" &&
            order.paymentStatus !== "PAID"
          ) {
            return { kind: "payment-required" as const };
          }
          if (input.status === "SHIPPED" && (!input.trackingNumber || !input.carrier)) {
            return { kind: "tracking-required" as const };
          }
          if (input.status === "CANCELLED") {
            await tx.payment.updateMany({
              where: { orderId: order.id, status: "PENDING" },
              data: { status: "FAILED" },
            });
            await tx.order.update({ where: { id }, data: { paymentStatus: "FAILED" } });
            for (const item of order.items) {
              if (!item.variantId) continue;
              await tx.productVariant.update({
                where: { id: item.variantId },
                data: { stock: { increment: item.quantity } },
              });
              await tx.inventoryMovement.create({
                data: {
                  variantId: item.variantId,
                  actorId: user.id,
                  quantity: item.quantity,
                  reason: "ORDER_RELEASE",
                  reference: order.number,
                },
              });
            }
          }

          const fulfillmentStatus =
            input.status === "CANCELLED" ? "CANCELLED" : input.status === "CONFIRMED" ? "UNFULFILLED" : input.status;
          await tx.order.update({ where: { id }, data: { status: input.status, fulfillmentStatus } });
          if (["SHIPPED", "DELIVERED"].includes(input.status)) {
            await tx.shipment.upsert({
              where: { orderId: id },
              create: {
                orderId: id,
                carrier: input.carrier,
                trackingNumber: input.trackingNumber,
                status: input.status,
                shippedAt: new Date(),
                deliveredAt: input.status === "DELIVERED" ? new Date() : null,
              },
              update: {
                carrier: input.carrier ?? order.shipment?.carrier,
                trackingNumber: input.trackingNumber ?? order.shipment?.trackingNumber,
                status: input.status,
                shippedAt: order.shipment?.shippedAt ?? new Date(),
                deliveredAt: input.status === "DELIVERED" ? new Date() : order.shipment?.deliveredAt,
              },
            });
          }
        }

        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: "ORDER_UPDATED",
            resource: "Order",
            resourceId: order.id,
            changes: {
              from: order.status,
              to: input.status ?? order.status,
              codCollected: Boolean(input.paymentCollected),
              trackingNumber: input.trackingNumber,
            },
          },
        });
        return { kind: "updated" as const };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (result.kind === "not-found") return apiError(404, "ORDER_NOT_FOUND", "The order was not found.");
    if (result.kind === "invalid-payment-state") return apiError(409, "INVALID_PAYMENT_STATE", "COD can only be settled after delivery and must not already be paid.");
    if (result.kind === "invalid-transition") return apiError(409, "INVALID_ORDER_TRANSITION", "That order status transition is not allowed.");
    if (result.kind === "refund-required") return apiError(409, "REFUND_REQUIRED", "Paid orders require a refund resolution before cancellation.");
    if (result.kind === "payment-required") return apiError(409, "PAYMENT_REQUIRED", "An online order must be verified by the payment provider before confirmation.");
    if (result.kind === "tracking-required") return apiError(400, "TRACKING_REQUIRED", "Carrier and tracking number are required before shipping.");
    return Response.json({ updated: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return apiError(409, "ORDER_CONFLICT", "The order changed concurrently. Refresh and try again.");
    }
    throw error;
  }
}
