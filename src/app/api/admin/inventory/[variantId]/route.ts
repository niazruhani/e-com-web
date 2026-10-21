import { z } from "zod";
import { apiError, isSameOriginMutation } from "@/lib/api";
import { getCurrentUser, hasPermission } from "@/lib/authorization";
import { prisma, isDatabaseConfigured } from "@/lib/db";

export const runtime = "nodejs";

const adjustmentSchema = z.object({
  delta: z.number().int().min(-1_000_000).max(1_000_000).refine((value) => value !== 0),
  reason: z.string().trim().min(3).max(200),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ variantId: string }> },
) {
  if (!isSameOriginMutation(request)) return apiError(403, "CSRF_REJECTED", "The request origin could not be verified.");
  if (!isDatabaseConfigured() || !process.env.AUTH_SECRET) return apiError(503, "ADMIN_UNAVAILABLE", "Admin services are not configured.");
  const user = await getCurrentUser();
  if (!user) return apiError(401, "UNAUTHENTICATED", "Sign in to access this resource.");
  if (!hasPermission(user.role, "inventory:write")) return apiError(403, "FORBIDDEN", "You do not have permission to adjust inventory.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "A valid JSON request body is required.");
  }
  const parsed = adjustmentSchema.safeParse(body);
  if (!parsed.success) return apiError(400, "VALIDATION_FAILED", "Provide a non-zero whole-unit adjustment and reason.");

  const { variantId } = await context.params;
  const updated = await prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.findUnique({ where: { id: variantId }, select: { stock: true } });
    if (!variant) return null;
    const nextStock = variant.stock + parsed.data.delta;
    if (nextStock < 0) return false;
    const changed = await tx.productVariant.updateMany({
      where: { id: variantId, stock: variant.stock },
      data: { stock: nextStock },
    });
    if (changed.count !== 1) return false;
    await tx.inventoryMovement.create({
      data: {
        variantId,
        actorId: user.id,
        quantity: parsed.data.delta,
        reason: `MANUAL_ADJUSTMENT: ${parsed.data.reason}`,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "INVENTORY_ADJUSTED",
        resource: "ProductVariant",
        resourceId: variantId,
        changes: { from: variant.stock, to: nextStock, reason: parsed.data.reason },
      },
    });
    return nextStock;
  });

  if (updated === null) return apiError(404, "VARIANT_NOT_FOUND", "The product option was not found.");
  if (updated === false) return apiError(409, "STOCK_CONFLICT", "Inventory changed or the adjustment would make stock negative.");
  return Response.json({ stock: updated });
}
