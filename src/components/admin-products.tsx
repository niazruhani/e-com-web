"use client";

import { useEffect, useState, type FormEvent } from "react";

type AdminProduct = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  status: string;
  category: string;
  variants: Array<{ id: string; sku: string; size: string | null; color: string | null; stock: number }>;
};

export function AdminProducts() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadProducts() {
    const response = await fetch("/api/admin/products", { cache: "no-store" });
    const result: unknown = await response.json();
    if (!response.ok || typeof result !== "object" || result === null || !("products" in result) || !Array.isArray(result.products)) {
      throw new Error("Product list could not be loaded.");
    }
    setProducts(result.products as AdminProduct[]);
  }

  useEffect(() => {
    void Promise.resolve().then(loadProducts).catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : "Product list could not be loaded.");
    });
  }, []);

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError("");
    setMessage("");
    setBusy(true);
    const form = new FormData(formElement);
    const sku = String(form.get("sku") ?? "").trim();
    const size = String(form.get("size") ?? "").trim();
    const variantSku = String(form.get("variantSku") ?? "").trim() || `${sku}-${size || "ONE"}`;
    const body = {
      sku,
      slug: String(form.get("slug") ?? ""),
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
      category: String(form.get("category") ?? ""),
      pricePaisa: Number(form.get("pricePaisa")),
      imageUrl: String(form.get("imageUrl") ?? ""),
      variants: [{
        sku: variantSku,
        size: size || undefined,
        color: String(form.get("color") ?? "").trim() || undefined,
        stock: Number(form.get("stock")),
      }],
    };
    try {
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const reason =
          typeof result === "object" && result !== null && "error" in result &&
          typeof result.error === "object" && result.error !== null && "message" in result.error &&
          typeof result.error.message === "string"
            ? result.error.message
            : "Product could not be created.";
        throw new Error(reason);
      }
      formElement.reset();
      setMessage("Product created.");
      await loadProducts();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Product could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function adjustStock(variantId: string, direction: 1 | -1) {
    const rawDelta = window.prompt("Whole units to adjust by:");
    if (rawDelta === null) return;
    const amount = Number(rawDelta);
    if (!Number.isInteger(amount) || amount < 1 || amount > 1_000_000) {
      setError("Enter a positive whole number.");
      return;
    }
    const reason = window.prompt("Reason for this inventory adjustment:");
    if (!reason?.trim()) {
      setError("An adjustment reason is required.");
      return;
    }
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/inventory/${encodeURIComponent(variantId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta: direction * amount, reason }),
      });
      if (!response.ok) {
        setError("Inventory adjustment was rejected. Refresh the list and try again.");
        return;
      }
      setMessage("Inventory updated.");
      await loadProducts();
    } catch {
      setError("Inventory adjustment could not be completed.");
    }
  }

  return (
    <div className="admin-products">
      <section className="info-detail">
        <h2>Create product</h2>
        <p>Prices are entered as integer paisa. Product image URLs must use the configured HTTPS image host.</p>
        <form className="checkout-form" onSubmit={createProduct}>
          <div className="form-two-col">
            <label>Product SKU<input name="sku" required maxLength={80} /></label>
            <label>URL slug<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" /></label>
          </div>
          <label>Product name<input name="name" required maxLength={180} /></label>
          <label>Description<textarea name="description" required maxLength={10000} rows={4} /></label>
          <div className="form-two-col">
            <label>Category<input name="category" required maxLength={80} /></label>
            <label>Price (paisa)<input name="pricePaisa" type="number" min="1" step="1" required /></label>
          </div>
          <label>Image URL<input name="imageUrl" type="url" required /></label>
          <div className="form-two-col">
            <label>Size / option<input name="size" maxLength={32} /></label>
            <label>Option SKU<input name="variantSku" maxLength={80} /></label>
          </div>
          <div className="form-two-col">
            <label>Colour<input name="color" maxLength={48} /></label>
            <label>Initial stock<input name="stock" type="number" min="0" step="1" required /></label>
          </div>
          <button className="button button-dark" disabled={busy} type="submit">{busy ? "Saving…" : "Create product"}</button>
        </form>
      </section>
      {error && <p className="checkout-error" role="alert">{error}</p>}
      {message && <p className="checkout-success" role="status">{message}</p>}
      <section className="order-history">
        <h2>Products and inventory</h2>
        {products.map((product) => (
          <article className="info-detail" key={product.id}>
            <div className="summary-line"><strong>{product.name}</strong><span>{product.status}</span></div>
            <p>{product.sku} · {product.category} · /products/{product.slug}</p>
            {product.variants.map((variant) => (
              <div className="summary-line" key={variant.id}>
                <span>{variant.sku} · {variant.color ?? "—"} · {variant.size ?? "One size"} · Stock: {variant.stock}</span>
                <span className="admin-stock-actions">
                  <button type="button" className="text-link" onClick={() => void adjustStock(variant.id, 1)}>Add stock</button>
                  <button type="button" className="text-link" onClick={() => void adjustStock(variant.id, -1)}>Remove stock</button>
                </span>
              </div>
            ))}
          </article>
        ))}
        {products.length === 0 && <p>No products found.</p>}
      </section>
    </div>
  );
}
