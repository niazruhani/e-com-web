import { timingSafeEqual } from "node:crypto";
import { apiError } from "@/lib/api";
import { isDatabaseConfigured } from "@/lib/db";
import { releaseExpiredReservations } from "@/lib/reservations";

export const runtime = "nodejs";

function validCronSecret(request: Request) {
  const configured = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configured || !supplied) return false;
  const expectedBuffer = Buffer.from(configured);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export async function POST(request: Request) {
  if (!validCronSecret(request)) return apiError(401, "UNAUTHORIZED", "A valid scheduler credential is required.");
  if (!isDatabaseConfigured()) return apiError(503, "DATABASE_UNAVAILABLE", "Reservation processing is not configured.");
  const released = await releaseExpiredReservations();
  return Response.json({ released });
}
