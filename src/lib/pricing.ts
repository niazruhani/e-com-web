export type PriceLine = { unitPrice: number; quantity: number };

export function calculateSubtotal(lines: PriceLine[]) {
  return lines.reduce((total, line) => {
    if (
      !Number.isSafeInteger(line.unitPrice) ||
      line.unitPrice < 0 ||
      !Number.isSafeInteger(line.quantity) ||
      line.quantity < 0
    ) {
      throw new RangeError("Price and quantity must be non-negative integers.");
    }
    const lineTotal = line.unitPrice * line.quantity;
    if (!Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(total + lineTotal)) {
      throw new RangeError("Price total exceeds the safe integer range.");
    }
    return total + lineTotal;
  }, 0);
}

export function calculateDiscount(subtotal: number, discountBasisPoints: number) {
  if (!Number.isSafeInteger(subtotal) || subtotal < 0) {
    throw new RangeError("Subtotal must be a non-negative integer amount.");
  }
  if (!Number.isSafeInteger(discountBasisPoints) || discountBasisPoints < 0 || discountBasisPoints > 10_000) {
    throw new RangeError("Discount must be integer basis points between 0 and 10000.");
  }
  const whole = Math.floor(subtotal / 10_000) * discountBasisPoints;
  const remainder = (subtotal % 10_000) * discountBasisPoints;
  const result = whole + Math.round(remainder / 10_000);
  if (!Number.isSafeInteger(result)) throw new RangeError("Discount exceeds the safe integer range.");
  return result;
}

export function calculateTax(subtotal: number, taxRateBasisPoints: number) {
  return calculateDiscount(subtotal, taxRateBasisPoints);
}
