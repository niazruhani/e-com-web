import { AccountPanel } from "@/components/account-panel";
import { isDatabaseConfigured } from "@/lib/db";
export const metadata = { title: "Account", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: authError } = await searchParams;
  if (!isDatabaseConfigured() || !process.env.AUTH_SECRET) {
    return (
      <main className="site-info-page">
        <p className="eyebrow">Your Dhaka Form</p>
        <h1>Account access is not configured.</h1>
        <p>Set up the database and server-side authentication environment before collecting customer credentials.</p>
      </main>
    );
  }
  return (
    <main className="site-info-page">
      <p className="eyebrow">Your Dhaka Form</p>
      <h1>Your account.</h1>
      <p>Sign in to review your account and orders.</p>
      {authError && <p className="checkout-error" role="alert">The verification link could not be completed. Request a new verification email or sign in.</p>}
      <AccountPanel emailDeliveryConfigured={Boolean(process.env.EMAIL_API_KEY && process.env.EMAIL_FROM)} />
    </main>
  );
}
