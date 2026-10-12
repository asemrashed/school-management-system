import { Router } from "express";
import { asyncHandler } from "../lib/errors";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import * as academics from "../controllers/academics.controller";

export const academicsRouter = Router();

academicsRouter.use(requireAuth);

academicsRouter.get("/subjects", asyncHandler(academics.listSubjects));
academicsRouter.post(
  "/subjects",
  requireRole("super_admin", "admin", "coordinator"),
  asyncHandler(academics.createSubject)
);

academicsRouter.patch(
  "/subjects/:id",
  requireRole("super_admin", "admin", "coordinator"),
  asyncHandler(academics.updateSubject)
);
academicsRouter.delete(
  "/subjects/:id",
  requireRole("super_admin", "admin", "coordinator"),
  asyncHandler(academics.deleteSubject)
);

academicsRouter.get("/routine", asyncHandler(academics.getRoutine));

academicsRouter.get("/class-assignments", asyncHandler(academics.listClassAssignments));
academicsRouter.post(
  "/class-assignments",
  requireRole("super_admin", "admin", "coordinator"),
  asyncHandler(academics.createClassAssignment)
);
academicsRouter.patch(
  "/class-assignments/:id",
  requireRole("super_admin", "admin", "coordinator"),
  asyncHandler(academics.updateClassAssignment)
);
academicsRouter.delete(
  "/class-assignments/:id",
  requireRole("super_admin", "admin", "coordinator"),
  asyncHandler(academics.deleteClassAssignment)
);

academicsRouter.get(
  "/sections/:id/roster",
  requireRole("super_admin", "admin", "coordinator", "teacher"),
  asyncHandler(academics.getSectionRoster)
);
