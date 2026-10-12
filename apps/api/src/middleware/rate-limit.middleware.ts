import rateLimit from "express-rate-limit";

// Lets the test suite run without being throttled (tests flip this back on
// for the dedicated rate-limit test). Never set this in production.
const skip = () => process.env.RATE_LIMIT_DISABLED === "true";

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { code: "RATE_LIMITED", message: "Too many login attempts. Try again later." },
});

export const passwordResetRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { code: "RATE_LIMITED", message: "Too many reset requests. Try again later." },
});

export const generalApiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
});

/** Public forms (contact / admission) — a person submits a few at most; bots submit hundreds. */
export const publicFormRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { code: "RATE_LIMITED", message: "Too many submissions. Please try again later." },
});
