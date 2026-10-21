import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatPrice } from "@/lib/catalog";
import { getCurrentUser } from "@/lib/authorization";
import { prisma, isDatabaseConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order details", robots: { index: false } };

export default async function OrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isDatabaseConfigured() || !process.env.AUTH_SECRET) {
    return <main className="site-info-page"><h1>Order details are not configured.</h1></main>;
  }
  const user = await getCurrentUser();
  if (!user) redirect("/account");
  const { id } = await params;
  const order = await prisma.order.findFirst({
    where: { id, userId: user.id },
    include: {
      items: true,
      payment: { select: { provider: true, status: true, verifiedAt: true } },
      shipment: { select: { carrier: true, trackingNumber: true, status: true, shippedAt: true, deliveredAt: true } },
    },
  });
  if (!order) notFound();

  return (
    <main className="page-main account-page">
      <Link href="/orders" className="under-link">← All orders</Link>
      <p className="eyebrow">Order details</p>
      <h1>{order.number}</h1>
      <p>Placed {order.createdAt.toLocaleDateString("en-BD")}</p>
      <div className="order-summary">
        <h2>Status</h2>
        <p>Order: {order.status.toLowerCase()}</p>
        <p>Payment: {order.paymentStatus.toLowerCase()} ({order.paymentProvider})</p>
        <p>Fulfilment: {order.fulfillmentStatus.toLowerCase()}</p>
        {order.shipment?.trackingNumber && (
          <p>Tracking: {order.shipment.carrier || "Carrier"} · {order.shipment.trackingNumber}</p>
        )}
      </div>
      <div className="order-summary">
        <h2>Items</h2>
        {order.items.map((item) => (
          <div className="summary-line" key={item.id}>
            <span>{item.productName} × {item.quantity}</span>
            <strong>{formatPrice(item.unitPricePaisa * item.quantity - item.discountPaisa)}</strong>
          </div>
        ))}
        <div className="summary-line"><span>Items</span><span>{formatPrice(order.subtotalPaisa)}</span></div>
        <div className="summary-line"><span>Delivery</span><span>{formatPrice(order.shippingPaisa)}</span></div>
        <div className="summary-line"><span>Tax / fee</span><span>{formatPrice(order.taxPaisa)}</span></div>
        <div className="summary-total"><span>Total</span><strong>{formatPrice(order.totalPaisa)}</strong></div>
      </div>
    </main>
  );
}
