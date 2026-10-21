import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/email";

function createAuth() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be configured with at least 32 characters.");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be configured before using authentication.");
  }

  return betterAuth({
    appName: "Dhaka Form",
    baseURL: process.env.AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    secret,
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: "customer",
          input: false,
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => {
        await sendTransactionalEmail({
          to: user.email,
          subject: "Reset your Dhaka Form password",
          text: `Use this secure link to reset your password: ${url}`,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendTransactionalEmail({
          to: user.email,
          subject: "Verify your Dhaka Form email",
          text: `Verify your email address using this secure link: ${url}`,
        });
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 14,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
    },
    advanced: {
      defaultCookieAttributes: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      },
    },
  });
}

let authInstance: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  authInstance ??= createAuth();
  return authInstance;
}
