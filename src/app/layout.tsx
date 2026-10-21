import type { Metadata, Viewport } from "next";
import { Notice, SiteFooter, SiteHeader, StoreProvider } from "@/components/store";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Dhaka Form — Thoughtful things for the everyday",
    template: "%s | Dhaka Form",
  },
  description:
    "Thoughtful everyday clothing and accessories. Designed with care in Bangladesh, made to feel like you.",
  applicationName: "Dhaka Form",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  openGraph: {
    type: "website",
    siteName: "Dhaka Form",
    title: "Dhaka Form — Thoughtful things for the everyday",
    description: "Designed with care in Bangladesh, made to feel like you.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#f8f7f2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <StoreProvider>
          <SiteHeader />
          <div id="main-content">{children}</div>
          <SiteFooter />
          <Notice />
          <PwaRegister />
        </StoreProvider>
      </body>
    </html>
  );
}
