import { doubleCsrf } from "csrf-csrf";
import type { Request } from "express";
import { env } from "../lib/providers";
import { SESSION_COOKIE } from "../lib/session";

/**
 * Double-submit-cookie CSRF protection. The client reads the token from
 * GET /auth/csrf-token and sends it back in the X-CSRF-Token header on
 * every mutating request (see apps/web lib/api-client.ts).
 *
 * getSessionIdentifier ties the CSRF cookie to this browser's own session
 * cookie (not to a verified user — it doesn't need to be, it only needs to
 * be stable per browser so a stolen CSRF cookie from a different session
 * can't be replayed here).
 */
const { doubleCsrfProtection, generateToken } = doubleCsrf({
  getSecret: () => env.SESSION_SECRET,
  getSessionIdentifier: (req: Request) => req.cookies?.[SESSION_COOKIE] ?? "anonymous",
  cookieName: env.NODE_ENV === "production" ? "__Host-csrf" : "csrf-token",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: env.COOKIE_SECURE,
    path: "/",
  },
  getTokenFromRequest: (req: Request) => req.headers["x-csrf-token"],
});

export { doubleCsrfProtection };
export const generateCsrfToken = generateToken;
