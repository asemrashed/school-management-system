import type { Request, Response } from "express";
import { reportRangeQuerySchema } from "@packages/shared-types";
import { prisma } from "../lib/prisma";

export async function feeCollectionReport(req: Request, res: Response) {
  const { from, to } = reportRangeQuerySchema.parse(req.query);
  const where = {
    ...(from || to
      ? { dueDate: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
      : {}),
  };

  const invoices = await prisma.invoice.findMany({ where });
  const totalDue = invoices.reduce((sum, i) => sum + i.amountDue, 0);
  const totalCollected = invoices.reduce((sum, i) => sum + i.amountPaid, 0);
  const outstandingCount = invoices.filter((i) => i.status !== "paid").length;

  const byMonthMap = new Map<string, { due: number; collected: number }>();
  for (const inv of invoices) {
    const key = `${inv.dueDate.getFullYear()}-${String(inv.dueDate.getMonth() + 1).padStart(2, "0")}`;
    const entry = byMonthMap.get(key) ?? { due: 0, collected: 0 };
    entry.due += inv.amountDue;
    entry.collected += inv.amountPaid;
    byMonthMap.set(key, entry);
  }
  const byMonth = Array.from(byMonthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }));

  res.json({ totalDue, totalCollected, outstandingCount, byMonth });
}

export async function attendanceReport(req: Request, res: Response) {
  const { from, to } = reportRangeQuerySchema.parse(req.query);
  const dateFilter = from || to ? { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } : undefined;

  const sections = await prisma.section.findMany({
    include: {
      attendanceRecords: dateFilter ? { where: { date: dateFilter } } : true,
    },
  });

  const rows = sections
    .filter((s) => s.attendanceRecords.length > 0)
    .map((s) => {
      const total = s.attendanceRecords.length;
      const present = s.attendanceRecords.filter((r) => r.status === "present").length;
      return {
        sectionId: s.id,
        sectionName: s.name,
        presentCount: present,
        totalCount: total,
        percentage: total > 0 ? Math.round((present / total) * 1000) / 10 : 0,
      };
    });

  res.json({ items: rows });
}

export async function defaulterReport(_req: Request, res: Response) {
  const invoices = await prisma.invoice.findMany({
    where: { status: { in: ["unpaid", "partial", "overdue"] } },
    include: { student: { include: { user: true, guardian: { include: { user: true } } } } },
    orderBy: { dueDate: "asc" },
  });

  const now = Date.now();
  const items = invoices.map((inv) => ({
    invoiceId: inv.id,
    studentName: inv.student.user.name,
    guardianName: inv.student.guardian?.user.name ?? null,
    amountOutstanding: inv.amountDue - inv.amountPaid,
    dueDate: inv.dueDate.toISOString().slice(0, 10),
    daysOverdue: Math.max(0, Math.floor((now - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24))),
  }));

  res.json({ items });
}
