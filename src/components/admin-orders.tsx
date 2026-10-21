"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPrice } from "@/lib/catalog";

type AdminOrder = {
  id: string;
  number: string;
  subtotalPaisa: number;
  shippingPaisa: number;
  taxPaisa: number;
  totalPaisa: number;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  paymentProvider: string;
  createdAt: string;
  items: Array<{ productName: string; sku: string; quantity: number; unitPricePaisa: number }>;
};

export function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadOrders = useCallback(async () => {
    const response = await fetch("/api/admin/orders", { cache: "no-store" });
    const result: unknown = await response.json();
    if (!response.ok || typeof result !== "object" || result === null || !("orders" in result) || !Array.isArray(result.orders)) {
      throw new Error("Order queue could not be loaded.");
    }
    setOrders(result.orders as AdminOrder[]);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadOrders).catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : "Order queue could not be loaded.");
    });
  }, [loadOrders]);

  async function updateOrder(id: string, body: Record<string, unknown>) {
    setMessage("");
    setError("");
    const response = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`, {
      method: "PATCH",
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
          : "Order update was rejected.";
      setError(reason);
      return;
    }
    setMessage("Order updated.");
    await loadOrders();
  }

  return (
    <section className="order-history">
      <h2>Order queue</h2>
      {error && <p className="checkout-error" role="alert">{error}</p>}
      {message && <p className="checkout-success" role="status">{message}</p>}
      {orders.map((order) => (
        <article className="info-detail" key={order.id}>
          <div className="summary-line">
            <strong>{order.number}</strong>
            <time dateTime={order.createdAt}>{new Date(order.createdAt).toLocaleString("en-BD")}</time>
          </div>
          <p>Order: {order.status.toLowerCase()} · Payment: {order.paymentStatus.toLowerCase()} ({order.paymentProvider})</p>
          <div className="summary-line">
            <span>{order.items.map((item) => `${item.productName} × ${item.quantity}`).join(", ")}</span>
            <strong>{formatPrice(order.totalPaisa)}</strong>
          </div>
          <details>
            <summary>Order snapshot and actions</summary>
            <p>Items: {formatPrice(order.subtotalPaisa)} · Delivery: {formatPrice(order.shippingPaisa)} · Tax/fee: {formatPrice(order.taxPaisa)}</p>
            {order.status === "PENDING" && (
              <div className="admin-stock-actions">
                {order.paymentProvider === "COD" && <button className="button button-outline" onClick={() => void updateOrder(order.id, { status: "CONFIRMED" })}>Confirm COD order</button>}
                <button className="text-link" onClick={() => void updateOrder(order.id, { status: "CANCELLED" })}>Cancel and release stock</button>
              </div>
            )}
            {order.status === "CONFIRMED" && (
              <button className="button button-outline" onClick={() => void updateOrder(order.id, { status: "PROCESSING" })}>Start processing</button>
            )}
            {order.status === "PROCESSING" && (
              <div className="checkout-form">
                <label>Carrier<input value={carrier} onChange={(event) => setCarrier(event.target.value)} required /></label>
                <label>Tracking number<input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} required /></label>
                <button
                  className="button button-dark"
                  disabled={!carrier.trim() || !trackingNumber.trim()}
                  onClick={() => void updateOrder(order.id, { status: "SHIPPED", carrier, trackingNumber })}
                >
                  Mark as shipped
                </button>
              </div>
            )}
            {order.status === "SHIPPED" && (
              <button className="button button-outline" onClick={() => void updateOrder(order.id, { status: "DELIVERED" })}>Mark as delivered</button>
            )}
            {order.status === "DELIVERED" && order.paymentProvider === "COD" && order.paymentStatus !== "PAID" && (
              <button className="button button-outline" onClick={() => void updateOrder(order.id, { paymentCollected: true })}>Record COD collection</button>
            )}
          </details>
        </article>
      ))}
      {orders.length === 0 && <p>No orders found.</p>}
    </section>
  );
}
