import { z } from "zod";

export const assignmentDtoSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  subjectId: z.string(),
  subjectName: z.string(),
  sectionId: z.string(),
  sectionName: z.string(),
  teacherName: z.string(),
  dueAt: z.string(),
  createdAt: z.string(),
});
export type AssignmentDto = z.infer<typeof assignmentDtoSchema>;

export const createAssignmentSchema = z.object({
  title: z.string().min(2).max(160),
  description: z.string().min(1).max(4000),
  subjectId: z.string(),
  sectionId: z.string(),
  dueAt: z.string().datetime(),
});
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;

export const submissionDtoSchema = z.object({
  id: z.string(),
  assignmentId: z.string(),
  studentId: z.string(),
  studentName: z.string(),
  body: z.string().nullable(),
  fileUrl: z.string().nullable(),
  submittedAt: z.string(),
  grade: z.number().nullable(),
  feedback: z.string().nullable(),
  /// Student/parent only see grade + feedback once this is set
  /// (lms-domain.md: "Assignment → Submission → Grade → Publish").
  gradePublishedAt: z.string().nullable(),
});
export type SubmissionDto = z.infer<typeof submissionDtoSchema>;

export const submitAssignmentSchema = z
  .object({
    body: z.string().max(8000).optional(),
    fileUrl: z.string().url().optional(),
  })
  .refine((v) => v.body || v.fileUrl, {
    message: "Provide a written answer or a file link.",
  });
export type SubmitAssignmentInput = z.infer<typeof submitAssignmentSchema>;

export const gradeSubmissionSchema = z.object({
  grade: z.number().min(0).max(1000),
  feedback: z.string().max(2000).optional(),
  publish: z.boolean().default(false),
});
export type GradeSubmissionInput = z.infer<typeof gradeSubmissionSchema>;
