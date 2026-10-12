import { Router } from "express";
import { asyncHandler } from "../lib/errors";
import * as publicController from "../controllers/public.controller";
import * as site from "../controllers/site.controller";
import { publicFormRateLimiter } from "../middleware/rate-limit.middleware";

export const publicRouter = Router();

publicRouter.get("/site", asyncHandler(site.getPublicSite));
publicRouter.get("/gallery", asyncHandler(site.listPublicGallery));
publicRouter.post("/contact", publicFormRateLimiter, asyncHandler(site.submitContact));
publicRouter.post("/admission", publicFormRateLimiter, asyncHandler(site.submitAdmission));
publicRouter.get("/notices", asyncHandler(publicController.listPublicNotices));
// Catch-all must stay last: matches /about, /contact, /policies/refund, etc.
// Express 4 wildcard — the matched tail is available as req.params[0].
publicRouter.get(
  "/pages/*",
  asyncHandler((req, res) => {
    (req.params as any).slug = req.params[0];
    return publicController.getPublicPage(req, res);
  })
);
