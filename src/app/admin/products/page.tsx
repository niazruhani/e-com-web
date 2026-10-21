import { redirect } from "next/navigation";
import { AdminProducts } from "@/components/admin-products";
import { getCurrentUser, hasPermission } from "@/lib/authorization";
import { isDatabaseConfigured } from "@/lib/db";

export const metadata = { title: "Products and inventory", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  if (!isDatabaseConfigured() || !process.env.AUTH_SECRET) {
    return <main className="site-info-page"><h1>Product management is not configured.</h1></main>;
  }
  const user = await getCurrentUser();
  if (!user) redirect("/account");
  if (!hasPermission(user.role, "catalog:write")) {
    return <main className="site-info-page"><h1>Access denied.</h1><p>Your account cannot manage the product catalog.</p></main>;
  }
  return (
    <main className="page-main admin-page">
      <p className="eyebrow">Catalog operations</p>
      <h1>Products & inventory.</h1>
      <AdminProducts />
    </main>
  );
}
