import type { Metadata } from "next";
import { CartContent } from "@/components/store";

export const metadata: Metadata = { title: "Your bag", robots: { index: false } };

export default function CartPage() {
  return <main className="page-main cart-page"><div className="page-title-row"><div><p className="eyebrow">A good choice</p><h1>Your bag.</h1></div><span className="page-aside-note">A little something for later, or right now.</span></div><CartContent /></main>;
}
