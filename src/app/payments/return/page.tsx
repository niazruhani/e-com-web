import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Payment status",
  robots: { index: false, follow: false },
};

export default async function PaymentReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>;
}) {
  const { reference } = await searchParams;
  return (
    <main className="site-info-page">
      <p className="eyebrow">Payment status</p>
      <h1>We’re checking with the payment provider.</h1>
      <p>
        A browser redirect does not confirm payment. Your order will only be marked paid after
        SSLCommerz verifies it with our server.
      </p>
      {reference && <p>Order reference: {reference}</p>}
      <Link className="button button-dark" href="/account">View your account</Link>
    </main>
  );
}
