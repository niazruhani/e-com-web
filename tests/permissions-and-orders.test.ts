import { describe, expect, it } from "vitest";
import { canTransitionOrder } from "../src/lib/order-state";
import { hasPermission } from "../src/lib/permissions";

describe("role permissions", () => {
  it("keeps staff capabilities separate", () => {
    expect(hasPermission("admin", "staff:write")).toBe(true);
    expect(hasPermission("manager", "staff:write")).toBe(false);
    expect(hasPermission("support", "orders:read")).toBe(true);
    expect(hasPermission("support", "inventory:write")).toBe(false);
    expect(hasPermission("fulfillment", "orders:write")).toBe(true);
    expect(hasPermission("customer", "orders:read")).toBe(false);
    expect(hasPermission(null, "orders:read")).toBe(false);
  });
});

describe("order status transitions", () => {
  it("allows only defined forward transitions", () => {
    expect(canTransitionOrder("PENDING", "CONFIRMED")).toBe(true);
    expect(canTransitionOrder("PROCESSING", "SHIPPED")).toBe(true);
    expect(canTransitionOrder("SHIPPED", "DELIVERED")).toBe(true);
    expect(canTransitionOrder("DELIVERED", "RETURNED")).toBe(true);
  });

  it("rejects invalid and terminal transitions", () => {
    expect(canTransitionOrder("PENDING", "SHIPPED")).toBe(false);
    expect(canTransitionOrder("DELIVERED", "CANCELLED")).toBe(false);
    expect(canTransitionOrder("CANCELLED", "CONFIRMED")).toBe(false);
    expect(canTransitionOrder("UNKNOWN", "CONFIRMED")).toBe(false);
  });
});
