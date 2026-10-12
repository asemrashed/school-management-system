import type { Request, Response } from "express";
import { createSalarySchema, markSalaryPaidSchema, type SalaryDto } from "@packages/shared-types";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { FINANCE_ROLES, STAFF_ROLES } from "../lib/scope";

function toSalaryDto(row: {
  id: string;
  staffId: string;
  staff: { name: string; role: string };
  month: number;
  year: number;
  baseAmount: number;
  deductions: number;
  bonuses: number;
  netAmount: number;
  paidAt: Date | null;
}): SalaryDto {
  return {
    id: row.id,
    staffId: row.staffId,
    staffName: row.staff.name,
    staffRole: row.staff.role,
    month: row.month,
    year: row.year,
    baseAmount: row.baseAmount,
    deductions: row.deductions,
    bonuses: row.bonuses,
    netAmount: row.netAmount,
    paidAt: row.paidAt?.toISOString() ?? null,
  };
}

export async function listSalaries(req: Request, res: Response) {
  const staffId = typeof req.query.staffId === "string" ? req.query.staffId : undefined;

  // Staff can view their own payslips; only admin/accountant see everyone's.
  const scopedStaffId = (FINANCE_ROLES as readonly string[]).includes(req.user!.role)
    ? staffId
    : req.user!.id;

  const rows = await prisma.salary.findMany({
    where: scopedStaffId ? { staffId: scopedStaffId } : undefined,
    include: { staff: true },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
  res.json({ items: rows.map(toSalaryDto) });
}

export async function createSalary(req: Request, res: Response) {
  const input = createSalarySchema.parse(req.body);
  const staff = await prisma.user.findUnique({ where: { id: input.staffId } });
  if (!staff || staff.deletedAt) throw AppError.badRequest("STAFF_NOT_FOUND", "That staff account does not exist.");
  // Payslips are for employees only — never parent/student accounts.
  if (!(STAFF_ROLES as readonly string[]).includes(staff.role)) {
    throw AppError.badRequest("NOT_STAFF", "Salary can only be recorded for staff accounts.");
  }

  const netAmount = input.baseAmount - input.deductions + input.bonuses;
  if (netAmount < 0) {
    throw AppError.badRequest("NEGATIVE_NET", "Deductions exceed base pay plus bonuses — net salary cannot be negative.");
  }
  const existing = await prisma.salary.findUnique({
    where: { staffId_month_year: { staffId: input.staffId, month: input.month, year: input.year } },
  });
  if (existing?.paidAt) {
    throw AppError.conflict("This month's salary has already been paid and can no longer be changed.");
  }
  const row = await prisma.salary.upsert({
    where: { staffId_month_year: { staffId: input.staffId, month: input.month, year: input.year } },
    update: { baseAmount: input.baseAmount, deductions: input.deductions, bonuses: input.bonuses, netAmount },
    create: { ...input, netAmount },
    include: { staff: true },
  });
  res.status(201).json({ salary: toSalaryDto(row) });
}

export async function markSalaryPaid(req: Request, res: Response) {
  const { salaryId } = markSalaryPaidSchema.parse(req.body);
  const existing = await prisma.salary.findUnique({ where: { id: salaryId } });
  if (!existing) throw AppError.notFound("Salary record not found.");
  if (existing.paidAt) throw AppError.conflict("This salary is already marked as paid.");
  const row = await prisma.salary.update({
    where: { id: salaryId },
    data: { paidAt: new Date() },
    include: { staff: true },
  });
  res.json({ salary: toSalaryDto(row) });
}
