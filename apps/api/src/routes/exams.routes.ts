import { Router } from "express";
import { asyncHandler } from "../lib/errors";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import * as examsController from "../controllers/exams.controller";

export const examsRouter = Router();

examsRouter.use(requireAuth);

examsRouter.get(
  "/",
  requireRole("super_admin", "admin", "coordinator", "teacher", "student", "parent"),
  asyncHandler(examsController.listExams)
);
// Exams are scheduled by the school (admin / coordinator) — never by a teacher.
examsRouter.post(
  "/",
  requireRole("super_admin", "admin", "coordinator"),
  asyncHandler(examsController.createExam)
);

examsRouter.get(
  "/:examId/marks",
  requireRole("super_admin", "admin", "coordinator", "teacher", "student", "parent"),
  asyncHandler(examsController.listMarks));
examsRouter.post(
  "/marks",
  requireRole("super_admin", "admin", "coordinator", "teacher"),
  asyncHandler(examsController.submitMarks)
);
// Teacher -> coordinator/admin approval chain. Publishing is automatic once a session is fully approved.
examsRouter.post(
  "/:examId/submit",
  requireRole("teacher"),
  asyncHandler(examsController.submitForApproval)
);
examsRouter.post(
  "/:examId/approve",
  requireRole("super_admin", "admin", "coordinator"),
  asyncHandler(examsController.approveExam)
);
examsRouter.post(
  "/:examId/reject",
  requireRole("super_admin", "admin", "coordinator"),
  asyncHandler(examsController.rejectExam)
);
