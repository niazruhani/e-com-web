import { describe, expect, it } from "vitest";
import { calculateDiscount, calculateSubtotal } from "../src/lib/pricing";

describe("calculateSubtotal", () => {
  it("adds integer minor-unit prices", () => {
    expect(calculateSubtotal([{ unitPrice: 485000, quantity: 2 }, { unitPrice: 320000, quantity: 1 }])).toBe(1290000);
  });

  it("returns zero for an empty bag", () => {
    expect(calculateSubtotal([])).toBe(0);
  });

  it("rejects negative, fractional, and unsafe totals", () => {
    expect(() => calculateSubtotal([{ unitPrice: -1, quantity: 1 }])).toThrow(RangeError);
    expect(() => calculateSubtotal([{ unitPrice: 10, quantity: 1.5 }])).toThrow(RangeError);
    expect(() => calculateSubtotal([{ unitPrice: Number.MAX_SAFE_INTEGER, quantity: 2 }])).toThrow(RangeError);
  });
});

describe("calculateDiscount", () => {
  it("rounds integer-basis-point discounts to whole minor units", () => {
    expect(calculateDiscount(485000, 1000)).toBe(48500);
    expect(calculateDiscount(99900, 1250)).toBe(12488);
  });

  it("rejects invalid totals and percentages", () => {
    expect(() => calculateDiscount(-5, 1000)).toThrow(RangeError);
    expect(() => calculateDiscount(1000, 10001)).toThrow(RangeError);
    expect(() => calculateDiscount(1000, 1.5)).toThrow(RangeError);
    expect(calculateDiscount(Number.MAX_SAFE_INTEGER, 10000)).toBe(Number.MAX_SAFE_INTEGER);
  });
});
