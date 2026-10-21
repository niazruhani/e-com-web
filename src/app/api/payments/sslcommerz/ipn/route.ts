import { Prisma } from "@prisma/client";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { CheckoutError } from "@/lib/checkout";
import { verifySslcommerzTransaction, verifiedAmountPaisa } from "@/lib/payments/sslcommerz";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const valId = form.get("val_id");
  if (typeof valId !== "string" || valId.length < 1 || valId.length > 200) {
    return apiError(400, "INVALID_WEBHOOK", "The provider transaction reference is missing.");
  }
  const eventId = `sslcommerz:${valId}`;
  if (await prisma.processedWebhook.findUnique({ where: { id: eventId } })) {
    return Response.json({ received: true, duplicate: true });
  }

  try {
    const verified = await verifySslcommerzTransaction(valId);
    if (
      !["VALID", "VALIDATED"].includes(String(verified.status)) ||
      typeof verified.tran_id !== "string" ||
      verified.currency !== "BDT"
    ) {
      return apiError(400, "PAYMENT_NOT_VERIFIED", "The payment could not be verified.");
    }
    const transactionReference = verified.tran_id;
    const amountPaisa = verifiedAmountPaisa(verified.amount);
    if (amountPaisa === null) {
      return apiError(400, "PAYMENT_NOT_VERIFIED", "The payment amount is invalid.");
    }

    await prisma.$transaction(
      async (tx) => {
        if (await tx.processedWebhook.findUnique({ where: { id: eventId } })) return;
        const payment = await tx.payment.findFirst({
          where: {
            provider: "SSLCOMMERZ",
            order: { number: transactionReference },
          },
          include: { order: true },
        });
        if (!payment || payment.amountPaisa !== amountPaisa || payment.currency !== "BDT") {
          throw new CheckoutError("The verified payment does not match the order.", 400, "PAYMENT_MISMATCH");
        }
        if (payment.status === "PAID") {
          await tx.processedWebhook.create({ data: { id: eventId, provider: "SSLCOMMERZ" } });
          return;
        }

        const transactionId =
          typeof verified.bank_tran_id === "string" && verified.bank_tran_id
            ? verified.bank_tran_id
            : valId;
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: "PAID", transactionId, verifiedAt: new Date() },
        });
        await tx.order.update({
          where: { id: payment.orderId },
          data: {
            paymentStatus: "PAID",
            status: payment.order.status === "CANCELLED" ? "CANCELLED" : "CONFIRMED",
            reservationExpiresAt: null,
          },
        });
        if (payment.order.status === "CANCELLED" || payment.status === "FAILED") {
          await tx.auditLog.create({
            data: {
              action: "LATE_PAYMENT_AFTER_ORDER_CANCELLATION",
              resource: "Order",
              resourceId: payment.orderId,
              changes: { provider: "SSLCOMMERZ" },
            },
          });
        }
        await tx.processedWebhook.create({ data: { id: eventId, provider: "SSLCOMMERZ" } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return Response.json({ received: true });
  } catch (error) {
    if (error instanceof CheckoutError) return apiError(error.status, error.code, error.message);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json({ received: true, duplicate: true });
    }
    throw error;
  }
}
