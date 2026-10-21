"use client";

import { useRouter } from "next/navigation";

export function CollectionControls({ category, sort }: { category: string; sort: string }) {
  const router = useRouter();
  return (
    <>
      <div className="collection-filters" aria-label="Filter by category">
        <a className={!category ? "filter-pill active-filter" : "filter-pill"} href="/collections">All pieces</a>
        <a className={category === "Clothing" ? "filter-pill active-filter" : "filter-pill"} href="/collections?category=Clothing">Clothing</a>
        <a className={category === "Accessories" ? "filter-pill active-filter" : "filter-pill"} href="/collections?category=Accessories">Accessories</a>
        <a className="filter-pill" href="/collections?sort=newest">New in</a>
      </div>
      <div className="sort-wrap">
        <label htmlFor="sort-products">Sort by</label>
        <select
          id="sort-products"
          value={sort}
          onChange={(event) => {
            const params = new URLSearchParams();
            if (category) params.set("category", category);
            params.set("sort", event.target.value);
            router.push(`/collections?${params.toString()}`);
          }}
        >
          <option value="featured">Featured</option>
          <option value="newest">Newest</option>
          <option value="popular">Popular</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="rating">Top rated</option>
        </select>
      </div>
    </>
  );
}
