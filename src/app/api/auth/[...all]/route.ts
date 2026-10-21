import { toNextJsHandler } from "better-auth/next-js";
import { apiError, configurationError } from "@/lib/api";
import { getAuth } from "@/lib/auth";

export const runtime = "nodejs";

async function handle(request: Request) {
  try {
    const handlers = toNextJsHandler(getAuth());
    return request.method === "GET" ? handlers.GET(request) : handlers.POST(request);
  } catch (error) {
    if (configurationError(error)) {
      return apiError(503, "AUTH_UNAVAILABLE", "Authentication is not configured.");
    }
    throw error;
  }
}

export const GET = handle;
export const POST = handle;
