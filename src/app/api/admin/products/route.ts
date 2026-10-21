import { z } from "zod";
import { apiError, isSameOriginMutation } from "@/lib/api";
import { getCurrentUser, hasPermission } from "@/lib/authorization";
import { prisma, isDatabaseConfigured } from "@/lib/db";

export const runtime = "nodejs";

const variantSchema = z.object({
  sku: z.string().trim().min(2).max(80).regex(/^[A-Za-z0-9._-]+$/),
  size: z.string().trim().max(32).optional(),
  color: z.string().trim().max(48).optional(),
  pricePaisa: z.number().int().positive().max(100_000_000).optional(),
  stock: z.number().int().min(0).max(1_000_000),
});

const productSchema = z.object({
  sku: z.string().trim().min(2).max(80).regex(/^[A-Za-z0-9._-]+$/),
  slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(2).max(180),
  description: z.string().trim().min(1).max(10_000),
  category: z.string().trim().min(2).max(80),
  pricePaisa: z.number().int().positive().max(100_000_000),
  compareAtPaisa: z.number().int().positive().max(100_000_000).optional(),
  imageUrl: z.string().url().max(2048).refine((value) => {
    const allowedHost = process.env.NEXT_PUBLIC_PRODUCT_IMAGE_HOST;
    if (!allowedHost) return false;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.hostname === allowedHost;
    } catch {
      return false;
    }
  }, "Image URL must use the configured HTTPS product-image host."),
  variants: z.array(variantSchema).min(1).max(100),
});

async function getStaff(permission: "catalog:write") {
  if (!isDatabaseConfigured() || !process.env.AUTH_SECRET) return { error: apiError(503, "ADMIN_UNAVAILABLE", "Admin services are not configured.") };
  const user = await getCurrentUser();
  if (!user) return { error: apiError(401, "UNAUTHENTICATED", "Sign in to access this resource.") };
  if (!hasPermission(user.role, permission)) return { error: apiError(403, "FORBIDDEN", "You do not have permission to manage products.") };
  return { user };
}

export async function GET() {
  const access = await getStaff("catalog:write");
  if ("error" in access) return access.error;
  const products = await prisma.product.findMany({
    include: { category: { select: { name: true } }, variants: { select: { id: true, sku: true, size: true, color: true, stock: true } } },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return Response.json({
    products: products.map((product) => ({
      id: product.id,
      sku: product.sku,
      slug: product.slug,
      name: product.name,
      status: product.status,
      category: product.category?.name ?? "Uncategorized",
      variants: product.variants,
    })),
  });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return apiError(403, "CSRF_REJECTED", "The request origin could not be verified.");
  const access = await getStaff("catalog:write");
  if ("error" in access) return access.error;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "A valid JSON request body is required.");
  }
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: { code: "VALIDATION_FAILED", message: "Check the product details.", fields: z.flattenError(parsed.error).fieldErrors } },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const categorySlug = input.category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const variantSkus = input.variants.map((variant) => variant.sku.toLowerCase());
  if (new Set(variantSkus).size !== variantSkus.length) {
    return apiError(400, "DUPLICATE_VARIANT_SKU", "Variant SKUs must be unique.");
  }

  const product = await prisma.$transaction(async (tx) => {
    const category = await tx.category.upsert({
      where: { slug: categorySlug },
      update: { name: input.category },
      create: { slug: categorySlug, name: input.category },
    });
    const created = await tx.product.create({
      data: {
        sku: input.sku,
        slug: input.slug,
        name: input.name,
        description: input.description,
        pricePaisa: input.pricePaisa,
        compareAtPaisa: input.compareAtPaisa,
        images: [input.imageUrl],
        categoryId: category.id,
        status: "ACTIVE",
        isDemo: false,
        variants: {
          create: input.variants.map((variant) => ({
            sku: variant.sku,
            size: variant.size,
            color: variant.color,
            pricePaisa: variant.pricePaisa,
            stock: variant.stock,
          })),
        },
      },
      include: { variants: true },
    });
    await tx.auditLog.create({
      data: {
        actorId: access.user.id,
        action: "PRODUCT_CREATED",
        resource: "Product",
        resourceId: created.id,
        changes: { sku: created.sku, slug: created.slug, variants: created.variants.length },
      },
    });
    await tx.inventoryMovement.createMany({
      data: created.variants.filter((variant) => variant.stock > 0).map((variant) => ({
        variantId: variant.id,
        actorId: access.user.id,
        quantity: variant.stock,
        reason: "INITIAL_STOCK",
      })),
    });
    return created;
  });

  return Response.json({ product: { id: product.id, sku: product.sku, slug: product.slug } }, { status: 201 });
}
