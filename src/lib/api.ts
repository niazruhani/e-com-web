export function apiError(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export function isSameOriginMutation(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const requestOrigin = new URL(origin).origin;
    const expectedOrigin = new URL(
      process.env.AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    ).origin;
    return requestOrigin === expectedOrigin;
  } catch {
    return false;
  }
}

export function configurationError(error: unknown) {
  return error instanceof Error && /not configured|must be configured/i.test(error.message);
}
