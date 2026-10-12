import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { asyncHandler } from "../lib/errors";
import { requireAuth } from "../middleware/auth.middleware";
import { loginRateLimiter, passwordResetRateLimiter } from "../middleware/rate-limit.middleware";

export const authRouter = Router();

authRouter.get("/csrf-token", asyncHandler(authController.getCsrfToken));
authRouter.post("/register", loginRateLimiter, asyncHandler(authController.register));
authRouter.post("/login", loginRateLimiter, asyncHandler(authController.login));
authRouter.post("/logout", requireAuth, asyncHandler(authController.logout));
authRouter.get("/me", asyncHandler(authController.me));

authRouter.post(
  "/password-reset/request",
  passwordResetRateLimiter,
  asyncHandler(authController.requestPasswordReset)
);
authRouter.post(
  "/password-reset/channel",
  passwordResetRateLimiter,
  asyncHandler(authController.chooseOtpChannel)
);
authRouter.post(
  "/password-reset/verify",
  passwordResetRateLimiter,
  asyncHandler(authController.verifyPasswordReset)
);
