import { z } from "zod";

const person = z.string().trim().min(2, "Name is too short").max(100);
const phone = z.string().trim().regex(/^\+?[0-9][0-9\s-]{6,18}$/, "Enter a valid phone number");
const emailField = z.string().trim().toLowerCase().email("Enter a valid email");

/** Existing guardian (picked from a dropdown) OR a new one to create. */
export const admitGuardianSchema = z.union([
  z.object({ guardianId: z.string().min(1) }),
  z.object({ name: person, email: emailField, phone }),
]);
export type AdmitGuardianInput = z.infer<typeof admitGuardianSchema>;

/**
 * Admission: creates the student's account, links the guardian, places the
 * student in a section with an auto roll number / student code, and raises
 * the first invoices — all in one step.
 */
export const admitStudentSchema = z.object({
  name: person,
  email: emailField,
  sectionId: z.string().min(1, "Choose a section"),
  dateOfBirth: z.string().date().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  address: z.string().trim().max(300).optional(),
  guardian: admitGuardianSchema,
  /** Fee structures to bill now. Omitted = the class's admission fee + this month's tuition. */
  feeStructureIds: z.array(z.string().min(1)).max(10).optional(),
  /** Due date for the invoices raised at admission (default: 10 days from now). */
  dueDate: z.string().date().optional(),
  /** Application being converted, if any (marks it approved). */
  applicationId: z.string().min(1).optional(),
});
export type AdmitStudentInput = z.infer<typeof admitStudentSchema>;

export const studentDtoSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  studentCode: z.string().nullable(),
  rollNumber: z.string().nullable(),
  sectionId: z.string().nullable(),
  sectionLabel: z.string().nullable(),
  guardianId: z.string().nullable(),
  guardianName: z.string().nullable(),
  guardianPhone: z.string().nullable(),
  isActive: z.boolean(),
  admittedAt: z.string(),
});
export type StudentDto = z.infer<typeof studentDtoSchema>;

export const admitStudentResultSchema = z.object({
  student: studentDtoSchema,
  invoices: z.array(z.object({ id: z.string(), feeName: z.string(), term: z.string(), amountDue: z.number().int() })),
  guardianCreated: z.boolean(),
});
export type AdmitStudentResult = z.infer<typeof admitStudentResultSchema>;

export const studentListQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  sectionId: z.string().optional(),
  classId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type StudentListQuery = z.infer<typeof studentListQuerySchema>;

export const updateStudentSchema = z.object({
  sectionId: z.string().min(1).optional(),
  rollNumber: z.string().trim().min(1).max(10).optional(),
  guardianId: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
