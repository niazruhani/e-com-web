import { redirect } from "next/navigation";
import { AdminOrders } from "@/components/admin-orders";
import { getCurrentUser, hasPermission } from "@/lib/authorization";
import { isDatabaseConfigured } from "@/lib/db";

export const metadata = { title: "Order operations", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  if (!isDatabaseConfigured() || !process.env.AUTH_SECRET) {
    return <main className="site-info-page"><h1>Order operations are not configured.</h1></main>;
  }
  const user = await getCurrentUser();
  if (!user) redirect("/account");
  if (!hasPermission(user.role, "orders:read")) {
    return <main className="site-info-page"><h1>Access denied.</h1><p>Your account cannot view orders.</p></main>;
  }
  return (
    <main className="page-main admin-page">
      <p className="eyebrow">Operations</p>
      <h1>Order management.</h1>
      <AdminOrders />
    </main>
  );
}
