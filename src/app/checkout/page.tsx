import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutForm } from "@/components/store";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function CheckoutPage() {
  const checkoutEnabled = Boolean(
    process.env.DATABASE_URL &&
      process.env.BUSINESS_POLICIES_CONFIRMED === "true" &&
      (process.env.SUPPORT_EMAIL || process.env.SUPPORT_PHONE) &&
      process.env.DELIVERY_FEE_DHAKA_PAISE &&
      process.env.DELIVERY_FEE_OUTSIDE_DHAKA_PAISE &&
      process.env.FREE_DELIVERY_THRESHOLD_PAISE &&
      process.env.TAX_RATE_BPS,
  );
  const onlinePaymentEnabled = Boolean(
    checkoutEnabled &&
      process.env.SSLCOMMERZ_STORE_ID &&
      process.env.SSLCOMMERZ_STORE_PASSWORD &&
      ["sandbox", "production"].includes(process.env.SSLCOMMERZ_MODE ?? ""),
  );
  return <main className="page-main checkout-page"><div className="checkout-top"><Link href="/cart" className="under-link">← Back to bag</Link><p className="eyebrow">A few more details</p><h1>Almost <em>yours.</em></h1><p>Review your details before placing an order.</p></div><CheckoutForm onlinePaymentEnabled={onlinePaymentEnabled} checkoutEnabled={checkoutEnabled} /></main>;
}
