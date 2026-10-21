import type { Metadata } from "next";
import { WishlistContent } from "@/components/store";

export const metadata: Metadata = { title: "Your wishlist", robots: { index: false } };

export default function WishlistPage() {
  return <main className="page-main wishlist-page"><div className="page-title-row"><div><p className="eyebrow">Keep what you love close</p><h1>Your wishlist.</h1></div><span className="page-aside-note">Good things are worth coming back to.</span></div><WishlistContent /></main>;
}
