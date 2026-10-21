import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function releaseExpiredReservations(now = new Date()) {
  return prisma.$transaction(
    async (tx) => {
      const orders = await tx.order.findMany({
        where: {
          status: "PENDING",
          paymentStatus: "PENDING",
          paymentProvider: "SSLCOMMERZ",
          reservationExpiresAt: { lte: now },
        },
        select: { id: true, number: true, items: { select: { variantId: true, quantity: true } } },
        orderBy: { reservationExpiresAt: "asc" },
        take: 100,
      });

      let released = 0;
      for (const order of orders) {
        const changed = await tx.order.updateMany({
          where: {
            id: order.id,
            status: "PENDING",
            paymentStatus: "PENDING",
            reservationExpiresAt: { lte: now },
          },
          data: {
            status: "CANCELLED",
            paymentStatus: "FAILED",
            fulfillmentStatus: "CANCELLED",
            reservationExpiresAt: null,
          },
        });
        if (changed.count !== 1) continue;

        await tx.payment.updateMany({
          where: { orderId: order.id, status: "PENDING" },
          data: { status: "FAILED" },
        });
        for (const item of order.items) {
          if (!item.variantId) continue;
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          });
          await tx.inventoryMovement.create({
            data: {
              variantId: item.variantId,
              quantity: item.quantity,
              reason: "ORDER_RELEASE",
              reference: order.number,
            },
          });
        }
        await tx.auditLog.create({
          data: {
            action: "PAYMENT_RESERVATION_EXPIRED",
            resource: "Order",
            resourceId: order.id,
            changes: { orderNumber: order.number },
          },
        });
        released += 1;
      }
      return released;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
