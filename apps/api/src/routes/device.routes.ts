import { Router } from "express";
import { asyncHandler } from "../lib/errors";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import * as deviceController from "../controllers/device.controller";

export const deviceRouter = Router();

deviceRouter.use(requireAuth, requireRole("super_admin"));

deviceRouter.get("/limits", asyncHandler(deviceController.listDeviceLimits));
deviceRouter.post("/limits", asyncHandler(deviceController.setDeviceLimit));
