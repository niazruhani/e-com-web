import { describe, expect, it } from "vitest";
import { checkoutFingerprint } from "../src/lib/checkout-fingerprint";

const order = {
  email: "buyer@example.com",
  phone: "+8801712345678",
  firstName: "A",
  lastName: "Buyer",
  address: "12 Example Road",
  division: "Dhaka",
  district: "Dhaka",
  area: "Gulshan",
  postalCode: "1212",
  paymentMethod: "COD",
  items: [
    { productId: "product-b", size: "M", quantity: 1 },
    { productId: "product-a", size: "S", quantity: 2 },
  ],
};

describe("checkout idempotency fingerprint", () => {
  it("is stable across item ordering and email case", () => {
    expect(checkoutFingerprint(order, "user-1")).toBe(
      checkoutFingerprint(
        { ...order, email: "BUYER@example.com", items: [...order.items].reverse() },
        "user-1",
      ),
    );
  });

  it("binds a key to the customer and order details", () => {
    expect(checkoutFingerprint(order, "user-1")).not.toBe(
      checkoutFingerprint(order, "user-2"),
    );
    expect(checkoutFingerprint(order, "user-1")).not.toBe(
      checkoutFingerprint({ ...order, paymentMethod: "SSLCOMMERZ" }, "user-1"),
    );
  });
});
