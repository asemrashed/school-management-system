import { Router } from "express";
import { asyncHandler } from "../lib/errors";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import * as lms from "../controllers/lms.controller";

export const lmsRouter = Router();

const LMS_VIEWERS = ["super_admin", "admin", "coordinator", "teacher", "student", "parent"] as const;
lmsRouter.use(requireAuth, requireRole(...LMS_VIEWERS));

lmsRouter.get("/resources", asyncHandler(lms.listResources));
lmsRouter.post("/resources", requireRole("teacher"), asyncHandler(lms.createResource));
lmsRouter.post(
  "/resources/:id/publish",
  requireRole("super_admin", "admin", "coordinator", "teacher"),
  asyncHandler(lms.publishResource)
);

lmsRouter.get("/assignments", asyncHandler(lms.listAssignments));
lmsRouter.post("/assignments", requireRole("teacher"), asyncHandler(lms.createAssignment));

lmsRouter.get(
  "/assignments/:assignmentId/submissions",
  asyncHandler(lms.listSubmissions)
);
lmsRouter.post(
  "/assignments/:assignmentId/submissions",
  requireRole("student"),
  asyncHandler(lms.submitAssignment)
);
lmsRouter.patch(
  "/submissions/:id",
  requireRole("super_admin", "admin", "coordinator", "teacher"),
  asyncHandler(lms.gradeSubmission)
);
