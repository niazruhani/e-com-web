import type { Product } from "@/lib/catalog";
import { isDatabaseConfigured, prisma } from "@/lib/db";

async function getDemoProducts(): Promise<Product[]> {
  if (process.env.NODE_ENV !== "development") return [];
  return (await import("@/lib/catalog-demo")).products;
}

export async function getProducts(): Promise<Product[]> {
  if (!isDatabaseConfigured()) {
    return getDemoProducts();
  }

  const rows = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      ...(process.env.NODE_ENV === "production" ? { isDemo: false } : {}),
    },
    include: {
      category: { select: { name: true } },
      variants: { where: { active: true }, orderBy: { createdAt: "asc" } },
      reviews: {
        where: {
          verifiedPurchase: true,
          status: "APPROVED",
          order: { is: { status: "DELIVERED" } },
        },
        select: { rating: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((product) => {
    const sizes = product.variants.map((variant) => variant.size || "One size");
    const variantIds = Object.fromEntries(
      product.variants.map((variant) => [variant.size || "One size", variant.id]),
    );
    const stock = product.variants.reduce((total, variant) => total + variant.stock, 0);
    const rating =
      product.reviews.length > 0
        ? product.reviews.reduce((total, review) => total + review.rating, 0) / product.reviews.length
        : 0;

    return {
      id: product.id,
      sku: product.sku,
      slug: product.slug,
      name: product.name,
      category: product.category?.name ?? "Collection",
      description: product.description,
      material: product.material ?? undefined,
      care: product.care ?? undefined,
      price: product.variants.find((variant) => variant.pricePaisa !== null)?.pricePaisa ?? product.pricePaisa,
      compareAt: product.compareAtPaisa ?? undefined,
      rating,
      reviews: product.reviews.length,
      image: product.images[0] || "/product-placeholder.svg",
      images: product.images,
      color: product.variants.find((variant) => variant.color)?.color ?? "—",
      sizes: [...new Set(sizes)],
      stock,
      stockBySize: Object.fromEntries(
        product.variants.map((variant) => [variant.size || "One size", variant.stock]),
      ),
      badge: stock === 0 ? "Sold out" : stock <= 3 ? "Low stock" : undefined,
      variantIds,
    };
  });
}

export async function getProductBySlug(slug: string) {
  return (await getProducts()).find((product) => product.slug === slug);
}

export async function getCategories() {
  if (!isDatabaseConfigured()) {
    if (process.env.NODE_ENV !== "development") return [];
    return (await import("@/lib/catalog-demo")).demoCategories;
  }
  const rows = await prisma.category.findMany({
    where: {
      active: true,
      products: {
        some: {
          status: "ACTIVE",
          ...(process.env.NODE_ENV === "production" ? { isDemo: false } : {}),
        },
      },
    },
    orderBy: { name: "asc" },
  });
  return rows.map((category) => ({
    name: category.name,
    detail: category.description ?? "Browse the collection",
    image: category.image || "/product-placeholder.svg",
    href: `/collections?category=${encodeURIComponent(category.name)}`,
  }));
}
