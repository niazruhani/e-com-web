export type Product = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  material?: string;
  care?: string;
  price: number;
  compareAt?: number;
  rating: number;
  reviews: number;
  image: string;
  images?: string[];
  color: string;
  sizes: string[];
  stock: number;
  stockBySize?: Record<string, number>;
  badge?: string;
  isNew?: boolean;
  bestseller?: boolean;
  variantIds?: Record<string, string>;
};

export function formatPrice(amount: number) {
  return new Intl.NumberFormat(process.env.NEXT_PUBLIC_LOCALE || "en-BD", {
    style: "currency",
    currency: process.env.NEXT_PUBLIC_CURRENCY || "BDT",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })
    .format(amount / 100)
    .replace("BDT", "৳");
}
