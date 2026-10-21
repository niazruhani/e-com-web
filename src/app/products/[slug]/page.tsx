import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductGrid, ProductPurchase, RecentlyViewed } from "@/components/store";
import { getProductBySlug, getProducts } from "@/lib/catalog-server";

type Props = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Piece not found" };
  return {
    title: product.name,
    description: product.description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: { title: `${product.name} | Dhaka Form`, description: product.description, images: [product.image], type: "website" },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [product, products] = await Promise.all([getProductBySlug(slug), getProducts()]);
  if (!product) notFound();
  const related = products.filter((item) => item.id !== product.id && item.category === product.category).slice(0, 4);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: [product.image],
    sku: product.sku,
    brand: { "@type": "Brand", name: "Dhaka Form" },
    offers: {
      "@type": "Offer",
      priceCurrency: process.env.NEXT_PUBLIC_CURRENCY || "BDT",
      price: (product.price / 100).toFixed(2),
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/products/${product.slug}`,
    },
  };
  return (
    <main className="page-main product-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <ProductPurchase product={product} />
      <section className="related-products">
        <div className="section-heading"><div><span className="eyebrow">You may also like</span><h2>Good together, <em>good on their own.</em></h2></div></div>
        <ProductGrid items={related} />
      </section>
      <RecentlyViewed excludeProductId={product.id} />
    </main>
  );
}
