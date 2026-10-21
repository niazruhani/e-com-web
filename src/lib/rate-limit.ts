import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function consumeRateLimit(
  scope: string,
  subject: string,
  maximum: number,
  windowSeconds: number,
) {
  const key = createHash("sha256").update(`${scope}\u0000${subject}`).digest("hex");
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  try {
    return await prisma.$transaction(
      async (tx) => {
        const bucket = await tx.rateLimit.findUnique({ where: { key } });
        if (!bucket || now - bucket.lastRequest >= windowMs) {
          await tx.rateLimit.upsert({
            where: { key },
            create: { key, count: 1, lastRequest: now },
            update: { count: 1, lastRequest: now },
          });
          return { allowed: true, retryAfterSeconds: 0 };
        }
        if (bucket.count >= maximum) {
          const retryAfterMs = windowMs - (now - bucket.lastRequest);
          return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
        }
        await tx.rateLimit.update({
          where: { key },
          data: { count: { increment: 1 }, lastRequest: now },
        });
        return { allowed: true, retryAfterSeconds: 0 };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return { allowed: false, retryAfterSeconds: 1 };
    }
    throw error;
  }
}

export function rateLimitSubject(request: Request) {
  const headerName = process.env.CLIENT_IP_HEADER || "x-real-ip";
  return request.headers.get(headerName)?.trim().slice(0, 128) || "unidentified-client";
}
