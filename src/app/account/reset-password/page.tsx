import { AccountPanel } from "@/components/account-panel";
import { isDatabaseConfigured } from "@/lib/db";

export const metadata = { title: "Reset password", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  if (!isDatabaseConfigured() || !process.env.AUTH_SECRET) {
    return <main className="site-info-page"><h1>Password reset is not configured.</h1></main>;
  }
  const { token } = await searchParams;
  return (
    <main className="site-info-page">
      <p className="eyebrow">Account security</p>
      <h1>Reset your password.</h1>
      <AccountPanel
        emailDeliveryConfigured={Boolean(process.env.EMAIL_API_KEY && process.env.EMAIL_FROM)}
        resetToken={token}
      />
    </main>
  );
}
