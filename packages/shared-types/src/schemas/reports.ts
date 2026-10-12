import { z } from "zod";

export const reportRangeQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});
export type ReportRangeQuery = z.infer<typeof reportRangeQuerySchema>;

export const feeCollectionReportSchema = z.object({
  totalDue: z.number().int(),
  totalCollected: z.number().int(),
  outstandingCount: z.number().int(),
  byMonth: z.array(z.object({ month: z.string(), due: z.number().int(), collected: z.number().int() })),
});
export type FeeCollectionReport = z.infer<typeof feeCollectionReportSchema>;

export const attendanceReportRowSchema = z.object({
  sectionId: z.string(),
  sectionName: z.string(),
  presentCount: z.number().int(),
  totalCount: z.number().int(),
  percentage: z.number(),
});
export type AttendanceReportRow = z.infer<typeof attendanceReportRowSchema>;

export const defaulterRowSchema = z.object({
  invoiceId: z.string(),
  studentName: z.string(),
  guardianName: z.string().nullable(),
  amountOutstanding: z.number().int(),
  dueDate: z.string(),
  daysOverdue: z.number().int(),
});
export type DefaulterRow = z.infer<typeof defaulterRowSchema>;
