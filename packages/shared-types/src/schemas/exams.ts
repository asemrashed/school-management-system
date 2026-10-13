import { z } from "zod";

export const examTypeSchema = z.enum(["online", "offline"]);
export type ExamType = z.infer<typeof examTypeSchema>;

export const examTermSchema = z.enum(["class_test", "mid_term", "final", "other"]);
export type ExamTerm = z.infer<typeof examTermSchema>;
export const EXAM_TERM_LABELS: Record<ExamTerm, string> = {
  class_test: "Class test",
  mid_term: "Mid-term",
  final: "Final",
  other: "Other",
};

/** draft -> submitted (teacher) -> approved (coordinator/admin) -> published (auto, when the whole session is approved) */
export const examStatusSchema = z.enum(["draft", "submitted", "approved", "published"]);
export type ExamStatus = z.infer<typeof examStatusSchema>;

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
  sessionId: z.string().nullable(),
  sessionName: z.string().nullable(),
  term: examTermSchema.nullable(),
  status: examStatusSchema,
  returnNote: z.string().nullable(),
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

export const rejectExamSchema = z.object({
  note: z.string().trim().min(3, "Tell the teacher what to fix.").max(500),
});
export type RejectExamInput = z.infer<typeof rejectExamSchema>;

/** Admin / coordinator create ONE session; it fans out to every section x subject. */
export const createExamSessionSchema = z.object({
  name: z.string().trim().min(2).max(160),
  term: examTermSchema,
  type: examTypeSchema.default("offline"),
  classId: z.string(),
  examDate: z.string().date(),
  subjects: z
    .array(z.object({ subjectId: z.string(), maxMarks: z.number().min(1).max(1000) }))
    .min(1, "Pick at least one subject.")
    .max(30),
  /** Omit to include every section of the class. */
  sectionIds: z.array(z.string()).min(1).optional(),
});
export type CreateExamSessionInput = z.infer<typeof createExamSessionSchema>;

export const examSessionDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  term: examTermSchema,
  classId: z.string(),
  className: z.string(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  progress: z.object({ total: z.number(), submitted: z.number(), approved: z.number() }),
});
export type ExamSessionDto = z.infer<typeof examSessionDtoSchema>;

export const examSessionExamRowSchema = z.object({
  examId: z.string(),
  subjectName: z.string(),
  sectionId: z.string(),
  sectionName: z.string(),
  teacherName: z.string().nullable(),
  maxMarks: z.number(),
  examDate: z.string(),
  status: examStatusSchema,
  marksEntered: z.number(),
  studentCount: z.number(),
  returnNote: z.string().nullable(),
});
export type ExamSessionExamRow = z.infer<typeof examSessionExamRowSchema>;

// --- Result sheet (spreadsheet view) ---

export const RESULT_SORTS = ["roll", "name", "total", "percent"] as const;
export const resultSheetQuerySchema = z.object({
  sectionId: z.string().optional(),
  q: z.string().trim().max(80).optional(),
  result: z.enum(["all", "pass", "fail"]).default("all"),
  sort: z.enum(RESULT_SORTS).default("roll"),
  dir: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(25),
  format: z.enum(["json", "csv"]).default("json"),
});
export type ResultSheetQuery = z.infer<typeof resultSheetQuerySchema>;

export interface ResultCell {
  obtained: number | null;
  status: ExamStatus | null;
}
export interface ResultRow {
  studentId: string;
  name: string;
  rollNumber: string | null;
  sectionName: string;
  cells: Record<string, ResultCell>; // keyed by subjectId
  total: number;
  maxTotal: number;
  percent: number | null;
  /** Letter grade and GPA are only computed for roles that see EVERY subject. */
  grade: string | null;
  gpa: number | null;
  passed: boolean | null;
}
export interface ResultSheetDto {
  session: { id: string; name: string; term: ExamTerm; className: string; publishedAt: string | null };
  subjects: { subjectId: string; name: string; maxMarks: number }[];
  rows: ResultRow[];
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
  /** True when this viewer sees all subjects (admin tier); false for a teacher's own-subject slice. */
  complete: boolean;
}

/** A published report card for the student/parent dashboards. */
export interface MyResultDto {
  studentId: string;
  studentName: string;
  sessions: {
    sessionId: string;
    sessionName: string;
    term: ExamTerm;
    publishedAt: string;
    subjects: { subjectName: string; obtained: number; maxMarks: number; grade: string }[];
    total: number;
    maxTotal: number;
    percent: number;
    grade: string;
    gpa: number;
    passed: boolean;
  }[];
}
