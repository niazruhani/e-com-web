import type { Metadata } from "next";
import Link from "next/link";
import { ProductGrid } from "@/components/store";
import { getProducts } from "@/lib/catalog-server";

export const metadata: Metadata = {
  title: "Search",
  description: "Find thoughtful everyday pieces from Dhaka Form.",
  robots: { index: false, follow: true },
};
export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const products = await getProducts();
  const query = q.trim().slice(0, 100);
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = products.filter((product) => {
    const text = `${product.name} ${product.description} ${product.category} ${product.color} ${product.sku}`.toLowerCase();
    return terms.every((term) => text.includes(term));
  });
  return (
    <main className="page-main">
      <div className="search-page-heading"><p className="eyebrow">Looking for something?</p><h1>Search <em>the collection.</em></h1><form className="search-page-form" action="/search"><label className="sr-only" htmlFor="search-query">Search products</label><input id="search-query" type="search" name="q" defaultValue={query} placeholder="Try linen, everyday, or accessories…" /><button className="button button-dark" type="submit">Search</button></form></div>
      {query ? <div className="search-results-heading"><h2>Results for “{query}”</h2><span>{matches.length} {matches.length === 1 ? "piece" : "pieces"}</span></div> : <div className="search-suggestions"><span>Popular places to start</span><Link href="/collections?category=Clothing">Clothing</Link><Link href="/collections?category=Accessories">Accessories</Link><Link href="/collections?sort=newest">New arrivals</Link></div>}
      {query && (matches.length ? <ProductGrid items={matches} /> : <div className="empty-collection"><h2>Nothing found just yet.</h2><p>Try another search, or explore all of our thoughtful everyday pieces.</p><Link href="/collections" className="under-link">Shop all pieces ↗</Link></div>)}
    </main>
  );
}
