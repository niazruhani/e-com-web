import Link from "next/link";
import { redirect } from "next/navigation";
import { formatPrice } from "@/lib/catalog";
import { getCurrentUser, hasPermission } from "@/lib/authorization";
import { isDatabaseConfigured, prisma } from "@/lib/db";

export const metadata = { title: "Admin dashboard", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!isDatabaseConfigured() || !process.env.AUTH_SECRET) {
    return (
      <main className="site-info-page">
        <p className="eyebrow">Studio access</p>
        <h1>Admin is not configured.</h1>
        <p>Set up PostgreSQL, authentication, and a verified staff account before using admin tools.</p>
      </main>
    );
  }
  const user = await getCurrentUser();
  if (!user) redirect("/account");
  if (!hasPermission(user.role, "orders:read") && !hasPermission(user.role, "catalog:write")) {
    return (
      <main className="site-info-page">
        <p className="eyebrow">Studio access</p>
        <h1>Access denied.</h1>
        <p>Your account does not have a dashboard permission.</p>
      </main>
    );
  }

  const canReadOrders = hasPermission(user.role, "orders:read");
  const canReadCatalog =
    hasPermission(user.role, "catalog:write") || hasPermission(user.role, "inventory:write");
  const [orderCount, pendingPaymentCount, paidRevenue, productCount, lowStockCount, recentOrders] =
    await Promise.all([
      canReadOrders ? prisma.order.count() : Promise.resolve(0),
      canReadOrders ? prisma.order.count({ where: { paymentStatus: "PENDING" } }) : Promise.resolve(0),
      hasPermission(user.role, "catalog:write")
        ? prisma.order.aggregate({ where: { paymentStatus: "PAID" }, _sum: { totalPaisa: true } })
        : Promise.resolve({ _sum: { totalPaisa: null } }),
      canReadCatalog ? prisma.product.count({ where: { isDemo: false } }) : Promise.resolve(0),
      canReadCatalog
        ? prisma.productVariant.count({ where: { active: true, stock: { lte: 3 }, product: { is: { isDemo: false } } } })
        : Promise.resolve(0),
      canReadOrders
        ? prisma.order.findMany({
            select: { id: true, number: true, status: true, paymentStatus: true, totalPaisa: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 8,
          })
        : Promise.resolve([]),
    ]);

  return (
    <main className="page-main admin-page">
      <p className="eyebrow">Studio access · {user.role}</p>
      <h1>Operations dashboard.</h1>
      <p>Live database figures only. No sample sales or estimated revenue are shown.</p>
      <section className="admin-metrics" aria-label="Business metrics">
        {canReadOrders && <article><span>Orders</span><strong>{orderCount}</strong></article>}
        {canReadOrders && <article><span>Pending payment</span><strong>{pendingPaymentCount}</strong></article>}
        {hasPermission(user.role, "catalog:write") && <article><span>Paid order totals</span><strong>{formatPrice(paidRevenue._sum.totalPaisa ?? 0)}</strong></article>}
        {canReadCatalog && <article><span>Products</span><strong>{productCount}</strong></article>}
        {canReadCatalog && <article><span>Low stock variants</span><strong>{lowStockCount}</strong></article>}
      </section>
      {hasPermission(user.role, "catalog:write") && (
        <p><Link className="button button-dark" href="/admin/products">Manage products and inventory</Link></p>
      )}
      {hasPermission(user.role, "orders:write") && (
        <p><Link className="button button-outline" href="/admin/orders">Manage orders</Link></p>
      )}
      {canReadOrders && (
        <section className="order-history">
          <h2>Recent orders</h2>
          {recentOrders.map((order) => (
            <article className="info-detail" key={order.id}>
              <div className="summary-line"><strong>{order.number}</strong><span>{order.createdAt.toLocaleString("en-BD")}</span></div>
              <p>Order: {order.status.toLowerCase()} · Payment: {order.paymentStatus.toLowerCase()}</p>
              <div className="summary-line"><strong>{formatPrice(order.totalPaisa)}</strong><span>{order.id}</span></div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
