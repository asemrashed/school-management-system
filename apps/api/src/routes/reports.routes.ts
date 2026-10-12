import { Router } from "express";
import { asyncHandler } from "../lib/errors";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import * as reports from "../controllers/reports.controller";

export const reportsRouter = Router();

reportsRouter.use(requireAuth);

reportsRouter.get("/fee-collection", requireRole("super_admin", "admin", "accountant"), asyncHandler(reports.feeCollectionReport));
reportsRouter.get("/attendance", requireRole("super_admin", "admin", "coordinator"), asyncHandler(reports.attendanceReport));
reportsRouter.get("/defaulters", requireRole("super_admin", "admin", "accountant"), asyncHandler(reports.defaulterReport));
