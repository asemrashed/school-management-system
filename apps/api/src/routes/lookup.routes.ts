import { Router } from "express";
import { asyncHandler } from "../lib/errors";
import { requireAuth } from "../middleware/auth.middleware";
import * as lookupController from "../controllers/lookup.controller";

export const lookupRouter = Router();
lookupRouter.use(requireAuth);
lookupRouter.get("/:kind", asyncHandler(lookupController.lookup));
