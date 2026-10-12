import { z } from "zod";
import { roleSchema } from "./roles";

/**
 * Academic setup (admin screens), routine, lookup and role-limit contracts.
 * Everything the admin picks from a list is referenced by id, but the UI
 * never asks a human to type one — see LookupKind / lookupItemSchema.
 */

const name = z.string().trim().min(1, "Name is required").max(80);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM, e.g. 08:45");

// --- Shifts -----------------------------------------------------------------

export const shiftDtoSchema = z.object({ id: z.string(), name: z.string() });
export type ShiftDto = z.infer<typeof shiftDtoSchema>;
export const upsertShiftSchema = z.object({ name });
export type UpsertShiftInput = z.infer<typeof upsertShiftSchema>;

// --- Classes & sections -----------------------------------------------------

export const classDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  shiftId: z.string(),
  shiftName: z.string(),
  sectionCount: z.number().int(),
});
export type ClassDto = z.infer<typeof classDtoSchema>;
export const createClassSchema = z.object({ name, shiftId: z.string().min(1) });
export const updateClassSchema = createClassSchema.partial();
export type CreateClassInput = z.infer<typeof createClassSchema>;

export const sectionDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  classId: z.string(),
  className: z.string(),
  roomId: z.string().nullable(),
  roomName: z.string().nullable(),
  studentCount: z.number().int(),
});
export type SectionDto = z.infer<typeof sectionDtoSchema>;
export const createSectionSchema = z.object({
  name,
  classId: z.string().min(1),
  roomId: z.string().min(1).nullable().optional(),
});
export const updateSectionSchema = createSectionSchema.partial();
export type CreateSectionInput = z.infer<typeof createSectionSchema>;

// --- Buildings & rooms (both optional for a school) -------------------------

export const buildingDtoSchema = z.object({ id: z.string(), name: z.string(), roomCount: z.number().int() });
export type BuildingDto = z.infer<typeof buildingDtoSchema>;
export const upsertBuildingSchema = z.object({ name });

export const roomDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  capacity: z.number().int().nullable(),
  buildingId: z.string().nullable(),
  buildingName: z.string().nullable(),
});
export type RoomDto = z.infer<typeof roomDtoSchema>;
export const createRoomSchema = z.object({
  name,
  capacity: z.number().int().min(1).max(500).nullable().optional(),
  buildingId: z.string().min(1).nullable().optional(),
});
export const updateRoomSchema = createRoomSchema.partial();
export type CreateRoomInput = z.infer<typeof createRoomSchema>;

// --- Subjects (create lives in academics.ts; update here) -------------------

export const updateSubjectSchema = z.object({ name: name.optional() });

// --- Academic years ---------------------------------------------------------

export const academicYearDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  isCurrent: z.boolean(),
});
export type AcademicYearDto = z.infer<typeof academicYearDtoSchema>;
export const createAcademicYearSchema = z
  .object({
    name,
    startDate: z.string().date(),
    endDate: z.string().date(),
    isCurrent: z.boolean().optional(),
  })
  .refine((v) => v.endDate > v.startDate, { message: "End date must be after the start date", path: ["endDate"] });
export type CreateAcademicYearInput = z.infer<typeof createAcademicYearSchema>;

// --- Periods (bell schedule) ------------------------------------------------

export const periodDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  shiftId: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  sortOrder: z.number().int(),
  isBreak: z.boolean(),
});
export type PeriodDto = z.infer<typeof periodDtoSchema>;
export const createPeriodSchema = z
  .object({
    name,
    shiftId: z.string().min(1),
    startTime: hhmm,
    endTime: hhmm,
    sortOrder: z.number().int().min(0).max(99).optional(),
    isBreak: z.boolean().optional(),
  })
  .refine((v) => v.endTime > v.startTime, { message: "End time must be after the start time", path: ["endTime"] });
export type CreatePeriodInput = z.infer<typeof createPeriodSchema>;

// --- Routine ----------------------------------------------------------------

/** Bangladesh school week runs Sunday–Thursday; the API accepts all seven. */
export const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export const weekdaySchema = z.enum(WEEKDAYS);
export type Weekday = z.infer<typeof weekdaySchema>;
export const WEEKDAY_LABELS: Record<Weekday, string> = {
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
};

export const routineSlotInputSchema = z.object({ dayOfWeek: weekdaySchema, periodId: z.string().min(1) });
export type RoutineSlotInput = z.infer<typeof routineSlotInputSchema>;

export const routineEntryDtoSchema = z.object({
  id: z.string(),
  assignmentId: z.string(),
  dayOfWeek: weekdaySchema,
  periodId: z.string(),
  shiftId: z.string(),
  sectionId: z.string(),
  sectionName: z.string(),
  className: z.string(),
  subjectName: z.string(),
  teacherName: z.string(),
  roomName: z.string().nullable(),
});
export type RoutineEntryDto = z.infer<typeof routineEntryDtoSchema>;

export const routineDtoSchema = z.object({
  periods: z.array(periodDtoSchema),
  entries: z.array(routineEntryDtoSchema),
});
export type RoutineDto = z.infer<typeof routineDtoSchema>;

// --- Lookup (searchable dropdowns) ------------------------------------------

export const LOOKUP_KINDS = [
  "teachers",
  "students",
  "classes",
  "sections",
  "subjects",
  "rooms",
  "buildings",
  "shifts",
  "periods",
  "guardians",
  "feeStructures",
  "staff",
  "users",
] as const;
export const lookupKindSchema = z.enum(LOOKUP_KINDS);
export type LookupKind = z.infer<typeof lookupKindSchema>;

export const lookupItemSchema = z.object({
  value: z.string(),
  label: z.string(),
  hint: z.string().optional(),
});
export type LookupItem = z.infer<typeof lookupItemSchema>;

export const lookupQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  classId: z.string().optional(),
  sectionId: z.string().optional(),
  shiftId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type LookupQuery = z.infer<typeof lookupQuerySchema>;

// --- Role account limits (Super Admin) --------------------------------------

export const roleAccountLimitRowSchema = z.object({
  role: roleSchema,
  maxAccounts: z.number().int().nullable(),
  activeAccounts: z.number().int(),
});
export type RoleAccountLimitRow = z.infer<typeof roleAccountLimitRowSchema>;

/** `maxAccounts: null` removes the cap for that role. */
export const setRoleAccountLimitSchema = z.object({
  role: roleSchema,
  maxAccounts: z.number().int().min(1).max(100000).nullable(),
});
export type SetRoleAccountLimitInput = z.infer<typeof setRoleAccountLimitSchema>;
