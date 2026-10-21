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

const image = (id: string, width = 1000) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`;

const demoProducts: Product[] = [
  {
    id: "p-01",
    sku: "DF-LIN-001",
    slug: "the-everyday-linen-shirt",
    name: "The Everyday Linen Shirt",
    category: "Clothing",
    description:
      "An easy, quietly considered staple in breathable European linen. Cut for a relaxed drape and made to be worn on repeat, from slow mornings to late dinners.",
    price: 485000,
    compareAt: 560000,
    rating: 4.9,
    reviews: 38,
    image: image("photo-1598554747436-c9293d6a588f"),
    color: "Oat",
    sizes: ["XS", "S", "M", "L", "XL"],
    stock: 7,
    badge: "Bestseller",
    bestseller: true,
  },
  {
    id: "p-02",
    sku: "DF-ACC-002",
    slug: "soft-structure-tote",
    name: "Soft Structure Tote",
    category: "Accessories",
    description:
      "A generous everyday carryall in softly structured cotton canvas, finished with considered details and sturdy hand-finished handles.",
    price: 320000,
    rating: 4.8,
    reviews: 24,
    image: image("photo-1544816155-12df9643f363"),
    color: "Moss",
    sizes: ["One size"],
    stock: 12,
    isNew: true,
  },
  {
    id: "p-03",
    sku: "DF-KNT-003",
    slug: "weekend-knit-polo",
    name: "Weekend Knit Polo",
    category: "Clothing",
    description:
      "A light, breathable knit with a clean collar and a little extra room. Designed to sit just as well with tailored trousers as it does with denim.",
    price: 425000,
    rating: 4.7,
    reviews: 16,
    image: image("photo-1618354691373-d851c5c3a990"),
    color: "Ink",
    sizes: ["S", "M", "L", "XL"],
    stock: 4,
    badge: "Low stock",
    bestseller: true,
  },
  {
    id: "p-04",
    sku: "DF-DRS-004",
    slug: "daylight-cotton-dress",
    name: "Daylight Cotton Dress",
    category: "Clothing",
    description:
      "Airy cotton and a gently gathered waist make this an effortless warm-weather favourite. Finished with discreet pockets for the things you reach for.",
    price: 590000,
    compareAt: 680000,
    rating: 4.9,
    reviews: 31,
    image: image("photo-1539109136881-3be0616acf4b"),
    color: "Terracotta",
    sizes: ["XS", "S", "M", "L"],
    stock: 9,
    badge: "Save 13%",
    isNew: true,
  },
  {
    id: "p-05",
    sku: "DF-SND-005",
    slug: "everywhere-leather-sandal",
    name: "Everywhere Leather Sandal",
    category: "Accessories",
    description:
      "A minimal leather sandal with a cushioned sole, thoughtfully made for long city walks and everything that follows.",
    price: 380000,
    rating: 4.6,
    reviews: 19,
    image: image("photo-1543163521-1bf539c55dd2"),
    color: "Sand",
    sizes: ["36", "37", "38", "39", "40", "41"],
    stock: 0,
    badge: "Sold out",
  },
  {
    id: "p-06",
    sku: "DF-OVR-006",
    slug: "the-sunday-overshirt",
    name: "The Sunday Overshirt",
    category: "Clothing",
    description:
      "An easy layer with a boxy shape, dropped shoulders and just enough weight to take the edge off a breezy evening.",
    price: 520000,
    rating: 4.8,
    reviews: 12,
    image: image("photo-1598033129183-c4f50c736f10"),
    color: "Clay",
    sizes: ["S", "M", "L", "XL"],
    stock: 6,
    isNew: true,
  },
  {
    id: "p-07",
    sku: "DF-BAG-007",
    slug: "soft-form-crossbody",
    name: "Soft Form Crossbody",
    category: "Accessories",
    description:
      "A compact, hands-free companion with room for the essentials. A considered everyday shape, finished in supple textured vegan leather.",
    price: 360000,
    rating: 4.7,
    reviews: 22,
    image: image("photo-1584917865442-de89df76afd3"),
    color: "Black",
    sizes: ["One size"],
    stock: 14,
    bestseller: true,
  },
  {
    id: "p-08",
    sku: "DF-TRS-008",
    slug: "slow-morning-trouser",
    name: "Slow Morning Trouser",
    category: "Clothing",
    description:
      "A softly tailored pull-on trouser in a fluid cotton blend. The relaxed fit and adjustable waist make comfort feel beautifully put together.",
    price: 450000,
    rating: 4.8,
    reviews: 27,
    image: image("photo-1515886657613-9f3515b0c78f"),
    color: "Stone",
    sizes: ["XS", "S", "M", "L", "XL"],
    stock: 8,
  },
];

export const demoCategories = [
  {
    name: "Clothing",
    detail: "Pieces for every day",
    image: image("photo-1483985988355-763728e1935b", 900),
    href: "/collections?category=Clothing",
  },
  {
    name: "Accessories",
    detail: "The finishing touches",
    image: image("photo-1490481651871-ab68de25d43d", 900),
    href: "/collections?category=Accessories",
  },
  {
    name: "New arrivals",
    detail: "Just found their way here",
    image: image("photo-1483985988355-763728e1935b", 900),
    href: "/collections?sort=newest",
  },
];

export const products: Product[] =
  process.env.NODE_ENV === "development" ? demoProducts : [];

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

export function findDemoProduct(slug: string) {
  return demoProducts.find((product) => product.slug === slug);
}
