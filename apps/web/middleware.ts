import { NextResponse, type NextRequest } from "next/server";

// Must match apps/api SESSION_COOKIE name (see apps/api/src/lib/session.ts).
const SESSION_COOKIE = "sms_session";

/**
 * Lightweight, edge-safe gate: only checks whether the session cookie is
 * present. It does NOT validate the session (that requires a DB call the
 * API owns) — every protected API route re-checks the real session via
 * requireAuth, and RBAC is re-checked server-side too (auth-rbac-matrix.md).
 * This middleware exists purely so a logged-out visitor is bounced from
 * /dashboard/* before any client code runs.
 */
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has(SESSION_COOKIE);

  if (req.nextUrl.pathname.startsWith("/dashboard") && !hasSession) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
