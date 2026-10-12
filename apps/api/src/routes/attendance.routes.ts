import { Router } from "express";
import { asyncHandler } from "../lib/errors";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import * as attendanceController from "../controllers/attendance.controller";

export const attendanceRouter = Router();

attendanceRouter.use(requireAuth);

attendanceRouter.get("/my-sections", requireRole("teacher"), asyncHandler(attendanceController.mySections));
attendanceRouter.get(
  "/",
  requireRole("super_admin", "admin", "coordinator", "teacher"),
  asyncHandler(attendanceController.getAttendance)
);
attendanceRouter.post(
  "/",
  requireRole("super_admin", "admin", "coordinator", "teacher"),
  asyncHandler(attendanceController.submitAttendance)
);
attendanceRouter.post(
  "/taker",
  requireRole("super_admin", "admin", "coordinator"),
  asyncHandler(attendanceController.setAttendanceTaker)
);
