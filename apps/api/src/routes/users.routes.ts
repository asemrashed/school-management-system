import { Router } from "express";
import { asyncHandler } from "../lib/errors";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import * as usersController from "../controllers/users.controller";

export const usersRouter = Router();

usersRouter.use(requireAuth, requireRole("super_admin", "admin"));
usersRouter.get("/", asyncHandler(usersController.listUsers));
usersRouter.post("/", asyncHandler(usersController.createUser));
