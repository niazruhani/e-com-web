import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/catalog-server";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const products = await getProducts();
  const pages = ["", "/collections", "/about", "/contact", "/faq", "/shipping", "/returns", "/privacy", "/terms"];
  return [
    ...pages.map((path) => ({ url: `${base}${path}`, changeFrequency: "weekly" as const, priority: path ? 0.6 : 1 })),
    ...products.map((product) => ({ url: `${base}/products/${product.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
