import { z } from "zod";
import { routineSlotInputSchema, weekdaySchema } from "./setup";

export const subjectDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  classId: z.string(),
});
export type SubjectDto = z.infer<typeof subjectDtoSchema>;
export const createSubjectSchema = z.object({
  name: z.string().min(1).max(80),
  classId: z.string(),
});

/**
 * One row = "this teacher teaches this subject to this section, in this
 * room, during this shift" (see MASTER_PLAN.md Phase 2: Class assignment).
 */
export const classAssignmentDtoSchema = z.object({
  id: z.string(),
  shiftId: z.string(),
  classId: z.string(),
  sectionId: z.string(),
  subjectId: z.string(),
  roomId: z.string().nullable(),
  teacherId: z.string(),
  teacherName: z.string(),
  subjectName: z.string(),
  sectionName: z.string(),
  className: z.string(),
  /** The "first teacher" who takes this section's daily attendance. */
  takesAttendance: z.boolean(),
  roomName: z.string().nullable(),
  slots: z.array(z.object({ id: z.string(), dayOfWeek: weekdaySchema, periodId: z.string() })),
});
export type ClassAssignmentDto = z.infer<typeof classAssignmentDtoSchema>;

export const createClassAssignmentSchema = z.object({
  /** Derived from the section's class when omitted. */
  shiftId: z.string().optional(),
  /** Derived from the section when omitted. */
  classId: z.string().optional(),
  sectionId: z.string().min(1, "Choose a section"),
  subjectId: z.string().min(1, "Choose a subject"),
  roomId: z.string().min(1).nullable().optional(),
  teacherId: z.string().min(1, "Choose a teacher"),
  takesAttendance: z.boolean().optional(),
  /** Weekly meeting times; the class routine is built from these. */
  slots: z.array(routineSlotInputSchema).max(60).optional(),
});
export type CreateClassAssignmentInput = z.infer<typeof createClassAssignmentSchema>;

export const updateClassAssignmentSchema = z.object({
  teacherId: z.string().min(1).optional(),
  roomId: z.string().min(1).nullable().optional(),
  takesAttendance: z.boolean().optional(),
  /** When present, REPLACES the assignment's weekly slots. */
  slots: z.array(routineSlotInputSchema).max(60).optional(),
});
export type UpdateClassAssignmentInput = z.infer<typeof updateClassAssignmentSchema>;

export const rosterStudentDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  rollNumber: z.string().nullable(),
});
export type RosterStudentDto = z.infer<typeof rosterStudentDtoSchema>;

// --- Attendance ---

export const attendanceStatusSchema = z.enum(["present", "absent", "late", "excused"]);
export type AttendanceStatus = z.infer<typeof attendanceStatusSchema>;

export const attendanceEntrySchema = z.object({
  studentId: z.string(),
  status: attendanceStatusSchema,
});

/**
 * Submits a whole section's attendance for one date in a single call
 * (lms-domain.md: assignable taker, teacher dashboard widget).
 */
export const submitAttendanceSchema = z.object({
  sectionId: z.string(),
  date: z.string().date(),
  entries: z.array(attendanceEntrySchema).min(1),
});
export type SubmitAttendanceInput = z.infer<typeof submitAttendanceSchema>;

export const attendanceRecordDtoSchema = z.object({
  id: z.string(),
  studentId: z.string(),
  studentName: z.string(),
  rollNumber: z.string().nullable(),
  sectionId: z.string(),
  date: z.string(),
  status: attendanceStatusSchema,
});
export type AttendanceRecordDto = z.infer<typeof attendanceRecordDtoSchema>;

export const attendanceQuerySchema = z.object({
  sectionId: z.string(),
  date: z.string().date(),
});

/** Who is delegated to take attendance for a section — defaults to the
 * section's first assigned teacher, admin can override (lms-domain.md). */
export const setAttendanceTakerSchema = z.object({
  sectionId: z.string(),
  teacherId: z.string(),
});
