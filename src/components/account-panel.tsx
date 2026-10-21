"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";

type Mode = "sign-in" | "sign-up" | "reset" | "reset-password";

export function AccountPanel({
  emailDeliveryConfigured,
  resetToken,
}: {
  emailDeliveryConfigured: boolean;
  resetToken?: string;
}) {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(resetToken ? "reset-password" : "sign-in");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    try {
      if (mode === "reset") {
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: `${window.location.origin}/account/reset-password`,
        });
        if (result.error) throw new Error(result.error.message || "Password reset could not be requested.");
        setMessage("If that address has an account, a password-reset link has been sent.");
      } else if (mode === "reset-password") {
        if (!resetToken) throw new Error("This password reset link is missing or invalid.");
        const result = await authClient.resetPassword({
          newPassword: String(form.get("password") ?? ""),
          token: resetToken,
        });
        if (result.error) throw new Error(result.error.message || "Password reset failed.");
        setMessage("Your password has been changed. Sign in with the new password.");
        setMode("sign-in");
      } else if (mode === "sign-up") {
        const result = await authClient.signUp.email({
          name: String(form.get("name") ?? ""),
          email,
          password: String(form.get("password") ?? ""),
          callbackURL: `${window.location.origin}/account`,
        });
        if (result.error) throw new Error(result.error.message || "Account registration failed.");
        setMessage("Check your inbox to verify your email before signing in.");
        setMode("sign-in");
      } else {
        const result = await authClient.signIn.email({
          email,
          password: String(form.get("password") ?? ""),
          callbackURL: `${window.location.origin}/account`,
        });
        if (result.error) throw new Error(result.error.message || "Sign in failed.");
        await authClient.getSession();
        router.refresh();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The request could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  if (isPending) {
    return <div className="info-detail" role="status">Checking your secure session…</div>;
  }

  if (session?.user) {
    return (
      <section className="account-panel">
        <p className="eyebrow">Signed in</p>
        <h2>Hello, {session.user.name}.</h2>
        <p>{session.user.email}</p>
        <nav className="account-links" aria-label="Account">
          <Link href="/orders" className="button button-dark">View your orders</Link>
          <Link href="/wishlist" className="button button-outline">Your wishlist</Link>
        </nav>
        <button
          className="text-link"
          type="button"
          onClick={async () => {
            const result = await authClient.signOut();
            if (result.error) {
              setError(result.error.message || "Sign out failed.");
              return;
            }
            router.refresh();
          }}
        >
          Sign out
        </button>
        {error && <p className="checkout-error" role="alert">{error}</p>}
      </section>
    );
  }

  if (mode === "reset-password") {
    return (
      <section className="account-panel">
        <h2>Choose a new password.</h2>
        <form className="checkout-form" onSubmit={submit}>
          <label>
            New password
            <input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
          </label>
          {error && <p className="checkout-error" role="alert">{error}</p>}
          {message && <p className="checkout-success" role="status">{message}</p>}
          <button className="button button-dark" type="submit" disabled={busy || !resetToken}>
            {busy ? "Please wait…" : "Change password"}
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="account-panel">
      <div className="account-mode-tabs" aria-label="Account actions">
        <button type="button" aria-pressed={mode === "sign-in"} onClick={() => setMode("sign-in")}>Sign in</button>
        <button
          type="button"
          aria-pressed={mode === "sign-up"}
          disabled={!emailDeliveryConfigured}
          onClick={() => setMode("sign-up")}
        >
          Create account
        </button>
      </div>
      {!emailDeliveryConfigured && (
        <p className="checkout-preview-notice" role="note">
          New account registration and password reset are paused until transactional email is configured.
          Existing verified customers can still sign in.
        </p>
      )}
      <form className="checkout-form" onSubmit={submit}>
        {mode === "sign-up" && (
          <label>
            Full name
            <input name="name" autoComplete="name" required minLength={2} maxLength={100} />
          </label>
        )}
        <label>
          Email address
          <input name="email" type="email" autoComplete="email" required maxLength={254} />
        </label>
        {mode !== "reset" && (
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              required
              minLength={8}
              maxLength={128}
            />
          </label>
        )}
        {error && <p className="checkout-error" role="alert">{error}</p>}
        {message && <p className="checkout-success" role="status">{message}</p>}
        <button className="button button-dark" type="submit" disabled={busy || (!emailDeliveryConfigured && mode !== "sign-in")}>
          {busy ? "Please wait…" : mode === "sign-up" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in"}
        </button>
      </form>
      {emailDeliveryConfigured && (
        <button
          type="button"
          className="text-link"
          onClick={() => setMode(mode === "reset" ? "sign-in" : "reset")}
        >
          {mode === "reset" ? "Back to sign in" : "Forgot your password?"}
        </button>
      )}
    </section>
  );
}
