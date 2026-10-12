import { Router } from "express";
import { asyncHandler } from "../lib/errors";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import * as messagingController from "../controllers/messaging.controller";

export const messagingRouter = Router();

messagingRouter.use(requireAuth, requireRole("super_admin"));
messagingRouter.get("/toggles", asyncHandler(messagingController.listToggles));
messagingRouter.patch("/toggles", asyncHandler(messagingController.updateToggle));
