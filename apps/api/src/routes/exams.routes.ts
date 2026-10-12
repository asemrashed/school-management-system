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
examsRouter.post(
  "/",
  requireRole("super_admin", "admin", "coordinator", "teacher"),
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
examsRouter.post(
  "/publish",
  requireRole("super_admin", "admin", "coordinator", "teacher"),
  asyncHandler(examsController.publishExam)
);
