import { Router } from "express";
import { asyncHandler } from "../lib/errors";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import * as students from "../controllers/students.controller";
import * as performance from "../controllers/performance.controller";

export const studentsRouter = Router();

studentsRouter.use(requireAuth);
// Declared before "/:id" so "mine" is never read as an id.
studentsRouter.get("/mine", requireRole("parent", "student"), asyncHandler(performance.myChildren));
studentsRouter.get("/", requireRole("super_admin", "admin", "coordinator", "accountant"), asyncHandler(students.listStudents));
studentsRouter.post("/admit", requireRole("super_admin", "admin", "coordinator"), asyncHandler(students.admit));
studentsRouter.patch("/:id", requireRole("super_admin", "admin", "coordinator"), asyncHandler(students.updateStudent));

// Ownership (parent/student) and section scope (teacher) are enforced in the controller.
studentsRouter.get(
  "/:id/performance",
  requireRole("super_admin", "admin", "coordinator", "teacher", "parent", "student"),
  asyncHandler(performance.getStudentPerformance)
);
