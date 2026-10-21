import type { Metadata } from "next";
import Link from "next/link";
import { CollectionControls } from "@/components/collection-controls";
import { ProductGrid } from "@/components/store";
import { getProducts } from "@/lib/catalog-server";

export const metadata: Metadata = {
  title: "Shop all",
  description: "Thoughtful everyday clothing and accessories, designed with care in Bangladesh.",
  alternates: { canonical: "/collections" },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export const dynamic = "force-dynamic";

export default async function CollectionsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const products = await getProducts();
  const category = typeof params.category === "string" ? params.category : "";
  const min = Number(params.min);
  const max = Number(params.max);
  const sort = typeof params.sort === "string" ? params.sort : "featured";
  const filtered = products.filter((product) =>
    (!category || product.category === category) &&
    (!Number.isFinite(min) || min <= 0 || product.price >= min) &&
    (!Number.isFinite(max) || max <= 0 || product.price <= max),
  );
  const sorted = [...filtered];
  if (sort === "price-asc") sorted.sort((a, b) => a.price - b.price);
  if (sort === "price-desc") sorted.sort((a, b) => b.price - a.price);
  if (sort === "newest") sorted.sort((a, b) => Number(Boolean(b.isNew)) - Number(Boolean(a.isNew)));
  if (sort === "popular") sorted.sort((a, b) => Number(Boolean(b.bestseller)) - Number(Boolean(a.bestseller)));
  if (sort === "rating") sorted.sort((a, b) => b.rating - a.rating);
  return (
    <main className="page-main">
      <div className="collection-banner">
        <div><p className="eyebrow">The Dhaka Form collection</p><h1>Thoughtful things<br />for the <em>everyday.</em></h1><p>Keep what feels like you. Wear it your way.</p></div>
        <span>Made slowly.<br />Worn often.</span>
      </div>
      <div className="collection-toolbar">
        <CollectionControls category={category} sort={sort} />
      </div>
      <div className="collection-count"><span>{sorted.length} pieces</span><span>Designed for real life</span></div>
      {sorted.length ? <ProductGrid items={sorted} /> : <div className="empty-collection"><h2>No pieces in this price range.</h2><p>Try adjusting your filters to find something lovely.</p><Link href="/collections" className="under-link">Clear filters ↗</Link></div>}
    </main>
  );
}
