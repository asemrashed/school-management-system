import { Router } from "express";
import { asyncHandler } from "../lib/errors";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import * as salaryController from "../controllers/salary.controller";

export const salaryRouter = Router();

salaryRouter.use(requireAuth);
// Payslips exist for staff only; parent/student accounts never reach salary data.
const SALARY_ROLES = ["super_admin", "admin", "coordinator", "teacher", "accountant", "librarian"] as const;

// Listing is open to any authenticated staff member — the controller
// scopes non-admin/accountant callers to their own payslips.
salaryRouter.get("/", requireRole(...SALARY_ROLES), asyncHandler(salaryController.listSalaries));
salaryRouter.post(
  "/",
  requireRole("super_admin", "admin", "accountant"),
  asyncHandler(salaryController.createSalary)
);
salaryRouter.post(
  "/paid",
  requireRole("super_admin", "admin", "accountant"),
  asyncHandler(salaryController.markSalaryPaid)
);
