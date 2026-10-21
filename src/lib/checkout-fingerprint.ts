import { createHash } from "node:crypto";

type CheckoutFingerprintInput = {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  address: string;
  division: string;
  district: string;
  area: string;
  postalCode: string;
  note?: string;
  paymentMethod: string;
  items: { productId: string; size: string; quantity: number }[];
};

export function checkoutFingerprint(input: CheckoutFingerprintInput, userId: string | null) {
  const canonical = {
    userId,
    email: input.email.toLowerCase(),
    phone: input.phone,
    firstName: input.firstName,
    lastName: input.lastName,
    address: input.address,
    division: input.division,
    district: input.district,
    area: input.area,
    postalCode: input.postalCode,
    note: input.note ?? "",
    paymentMethod: input.paymentMethod,
    items: [...input.items].sort(
      (left, right) =>
        left.productId.localeCompare(right.productId) || left.size.localeCompare(right.size),
    ),
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
