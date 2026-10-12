import { z } from "zod";

export const examTypeSchema = z.enum(["online", "offline"]);
export type ExamType = z.infer<typeof examTypeSchema>;

export const examDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: examTypeSchema,
  subjectId: z.string(),
  subjectName: z.string(),
  sectionId: z.string(),
  sectionName: z.string(),
  examDate: z.string(),
  maxMarks: z.number(),
  publishedAt: z.string().nullable(),
});
export type ExamDto = z.infer<typeof examDtoSchema>;

export const createExamSchema = z.object({
  name: z.string().min(2).max(160),
  type: examTypeSchema,
  subjectId: z.string(),
  sectionId: z.string(),
  examDate: z.string().date(),
  maxMarks: z.number().min(1).max(1000),
});
export type CreateExamInput = z.infer<typeof createExamSchema>;

export const markEntrySchema = z.object({
  studentId: z.string(),
  marksObtained: z.number().min(0),
  comment: z.string().max(500).optional(),
});

/** Marks entry for a whole section at once (mirrors attendance's
 * per-section batch submit — see academics.ts submitAttendanceSchema). */
export const submitMarksSchema = z.object({
  examId: z.string(),
  entries: z.array(markEntrySchema).min(1),
});
export type SubmitMarksInput = z.infer<typeof submitMarksSchema>;

export const markDtoSchema = z.object({
  id: z.string(),
  examId: z.string(),
  studentId: z.string(),
  studentName: z.string(),
  rollNumber: z.string().nullable(),
  marksObtained: z.number(),
  comment: z.string().nullable(),
});
export type MarkDto = z.infer<typeof markDtoSchema>;

/**
 * Publishing an exam's marks triggers `result_published` to every graded
 * student's guardian (lms-domain.md). Until published, marks are only
 * visible to staff — never to parent/student (same "no visibility until
 * published" rule as Resource).
 */
export const publishExamSchema = z.object({
  examId: z.string(),
});
