import { apiError } from "@/lib/api";
import { getCurrentUser, hasPermission } from "@/lib/authorization";
import { isDatabaseConfigured, prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  if (!isDatabaseConfigured() || !process.env.AUTH_SECRET) return apiError(503, "ADMIN_UNAVAILABLE", "Admin services are not configured.");
  const user = await getCurrentUser();
  if (!user) return apiError(401, "UNAUTHENTICATED", "Sign in to access this resource.");
  if (!hasPermission(user.role, "orders:read")) return apiError(403, "FORBIDDEN", "You do not have permission to view orders.");
  const orders = await prisma.order.findMany({
    select: {
      id: true,
      number: true,
      subtotalPaisa: true,
      shippingPaisa: true,
      taxPaisa: true,
      totalPaisa: true,
      status: true,
      paymentStatus: true,
      fulfillmentStatus: true,
      paymentProvider: true,
      createdAt: true,
      items: { select: { productName: true, sku: true, quantity: true, unitPricePaisa: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return Response.json({ orders });
}
