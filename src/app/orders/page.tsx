import Link from "next/link";
import { redirect } from "next/navigation";
import { formatPrice } from "@/lib/catalog";
import { getCurrentUser } from "@/lib/authorization";
import { prisma, isDatabaseConfigured } from "@/lib/db";

export const metadata = { title: "Your orders", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  if (!isDatabaseConfigured() || !process.env.AUTH_SECRET) {
    return (
      <main className="site-info-page">
        <h1>Order history is not configured.</h1>
        <p>Customer order records are available after database and authentication setup.</p>
      </main>
    );
  }
  const user = await getCurrentUser();
  if (!user) redirect("/account");

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      number: true,
      totalPaisa: true,
      status: true,
      paymentStatus: true,
      fulfillmentStatus: true,
      createdAt: true,
      items: { select: { productName: true, quantity: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <main className="page-main account-page">
      <p className="eyebrow">Your Dhaka Form</p>
      <h1>Your orders.</h1>
      {orders.length === 0 ? (
        <div className="empty-state">
          <h2>No orders yet.</h2>
          <p>Orders placed while signed in will appear here.</p>
          <Link href="/collections" className="button button-dark">Explore the collection</Link>
        </div>
      ) : (
        <div className="order-history">
          {orders.map((order) => (
            <article className="info-detail" key={order.id}>
              <div className="summary-line">
                <strong>{order.number}</strong>
                <time dateTime={order.createdAt.toISOString()}>{order.createdAt.toLocaleDateString("en-BD")}</time>
              </div>
              <p>{order.items.map((item) => `${item.productName} × ${item.quantity}`).join(", ")}</p>
              <p>
                Order: {order.status.toLowerCase()} · Payment: {order.paymentStatus.toLowerCase()} ·
                Fulfilment: {order.fulfillmentStatus.toLowerCase()}
              </p>
              <div className="summary-line">
                <strong>{formatPrice(order.totalPaisa)}</strong>
                <Link className="under-link" href={`/orders/${order.id}`}>View details ↗</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
