import { z } from "zod";

/** One student's report card: attendance, published results and assignment progress. */
export const performanceDtoSchema = z.object({
  studentId: z.string(),
  studentName: z.string(),
  className: z.string().nullable(),
  sectionName: z.string().nullable(),
  attendance: z.object({
    total: z.number().int(),
    present: z.number().int(),
    absent: z.number().int(),
    late: z.number().int(),
    /** Late still counts as attended. null when nothing is recorded yet. */
    percent: z.number().nullable(),
  }),
  overallPercent: z.number().nullable(),
  subjects: z.array(z.object({ subjectName: z.string(), examsCount: z.number().int(), averagePercent: z.number().nullable() })),
  exams: z.array(
    z.object({
      examId: z.string(),
      examName: z.string(),
      subjectName: z.string(),
      examDate: z.string(),
      marksObtained: z.number(),
      maxMarks: z.number(),
      percent: z.number(),
    })
  ),
  assignments: z.object({ total: z.number().int(), submitted: z.number().int(), graded: z.number().int() }),
});
export type PerformanceDto = z.infer<typeof performanceDtoSchema>;

export const childSummaryDtoSchema = z.object({
  studentId: z.string(),
  name: z.string(),
  className: z.string().nullable(),
  sectionName: z.string().nullable(),
  rollNumber: z.string().nullable(),
});
export type ChildSummaryDto = z.infer<typeof childSummaryDtoSchema>;
