import { PrismaClient } from "@prisma/client";
import { products } from "../src/lib/catalog-demo";

if (process.env.NODE_ENV !== "development") {
  throw new Error("The sample catalog seed is restricted to NODE_ENV=development.");
}
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to seed the development catalog.");
}

const prisma = new PrismaClient();

function slugPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function main() {
  for (const categoryName of new Set(products.map((product) => product.category))) {
    await prisma.category.upsert({
      where: { slug: slugPart(categoryName) },
      update: { name: categoryName, active: true },
      create: { name: categoryName, slug: slugPart(categoryName), active: true },
    });
  }

  for (const product of products) {
    const category = await prisma.category.findUniqueOrThrow({
      where: { slug: slugPart(product.category) },
    });
    await prisma.product.upsert({
      where: { id: product.id },
      update: {
        sku: product.sku,
        slug: product.slug,
        name: product.name,
        description: product.description,
        pricePaisa: product.price,
        compareAtPaisa: product.compareAt,
        images: [product.image],
        status: "ACTIVE",
        categoryId: category.id,
        isDemo: true,
      },
      create: {
        id: product.id,
        sku: product.sku,
        slug: product.slug,
        name: product.name,
        description: product.description,
        pricePaisa: product.price,
        compareAtPaisa: product.compareAt,
        images: [product.image],
        status: "ACTIVE",
        categoryId: category.id,
        isDemo: true,
      },
    });

    const stockPerSize = Math.floor(product.stock / product.sizes.length);
    const remainingStock = product.stock % product.sizes.length;
    for (const [index, size] of product.sizes.entries()) {
      const sizeSlug = slugPart(size) || "one-size";
      await prisma.productVariant.upsert({
        where: { id: `${product.id}-${sizeSlug}` },
        update: {
          sku: `${product.sku}-${sizeSlug.toUpperCase()}`,
          size,
          color: product.color,
          pricePaisa: product.price,
          stock: stockPerSize + Number(index < remainingStock),
          active: true,
        },
        create: {
          id: `${product.id}-${sizeSlug}`,
          productId: product.id,
          sku: `${product.sku}-${sizeSlug.toUpperCase()}`,
          size,
          color: product.color,
          pricePaisa: product.price,
          stock: stockPerSize + Number(index < remainingStock),
          active: true,
        },
      });
    }
  }

  console.info(`Seeded ${products.length} development-only demo products.`);
}

main()
  .catch((error: unknown) => {
    console.error("Development catalog seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
