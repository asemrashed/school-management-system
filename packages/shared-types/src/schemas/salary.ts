import { z } from "zod";

// Money is always an integer number of paisa (db-schema.md, erp-domain.md).
const paisaAmount = z.number().int().nonnegative();

export const salaryDtoSchema = z.object({
  id: z.string(),
  staffId: z.string(),
  staffName: z.string(),
  staffRole: z.string(),
  month: z.number().int().min(1).max(12),
  year: z.number().int(),
  baseAmount: paisaAmount,
  deductions: paisaAmount,
  bonuses: paisaAmount,
  netAmount: paisaAmount,
  paidAt: z.string().nullable(),
});
export type SalaryDto = z.infer<typeof salaryDtoSchema>;

/**
 * `staffId` refers to a User id (any staff role: teacher, accountant,
 * librarian, admin, coordinator) — Salary is not restricted to the Staff
 * table alone, since teachers are paid too.
 */
export const createSalarySchema = z.object({
  staffId: z.string(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  baseAmount: paisaAmount,
  deductions: paisaAmount.default(0),
  bonuses: paisaAmount.default(0),
});
export type CreateSalaryInput = z.infer<typeof createSalarySchema>;

export const markSalaryPaidSchema = z.object({
  salaryId: z.string(),
});
