import { Router } from "express";
import { asyncHandler } from "../lib/errors";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import * as cms from "../controllers/cms.controller";

export const cmsRouter = Router();

cmsRouter.use(requireAuth, requireRole("super_admin", "admin", "coordinator"));

cmsRouter.get("/pages", asyncHandler(cms.listPages));
cmsRouter.post("/pages", asyncHandler(cms.createPage));
cmsRouter.patch("/pages/:id", asyncHandler(cms.updatePage));
