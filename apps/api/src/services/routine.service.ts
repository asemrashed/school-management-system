import type { Prisma } from "@prisma/client";
import type {
  ClassAssignmentDto,
  PeriodDto,
  RoutineEntryDto,
  RoutineSlotInput,
  Weekday,
} from "@packages/shared-types";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";

/**
 * The class routine is DERIVED: every RoutineSlot (assignment x weekday x
 * period) is one cell. Nothing here stores a second copy of the timetable,
 * so changing an assignment's teacher/room/slots updates every routine view
 * (admin, teacher, student, parent) at once.
 */

export const assignmentInclude = {
  teacher: { include: { user: true } },
  subject: true,
  section: true,
  class: true,
  room: true,
  slots: true,
} satisfies Prisma.ClassAssignmentInclude;

export type AssignmentRow = Prisma.ClassAssignmentGetPayload<{ include: typeof assignmentInclude }>;

export function toAssignmentDto(row: AssignmentRow): ClassAssignmentDto {
  return {
    id: row.id,
    shiftId: row.shiftId,
    classId: row.classId,
    sectionId: row.sectionId,
    subjectId: row.subjectId,
    roomId: row.roomId,
    teacherId: row.teacherId,
    teacherName: row.teacher.user.name,
    subjectName: row.subject.name,
    sectionName: row.section.name,
    className: row.class.name,
    takesAttendance: row.takesAttendance,
    roomName: row.room?.name ?? null,
    slots: row.slots.map((s) => ({ id: s.id, dayOfWeek: s.dayOfWeek as Weekday, periodId: s.periodId })),
  };
}

export const toPeriodDto = (p: {
  id: string;
  name: string;
  shiftId: string;
  startTime: string;
  endTime: string;
  sortOrder: number;
  isBreak: boolean;
}): PeriodDto => ({
  id: p.id,
  name: p.name,
  shiftId: p.shiftId,
  startTime: p.startTime,
  endTime: p.endTime,
  sortOrder: p.sortOrder,
  isBreak: p.isBreak,
});

/** "08:00-08:45" overlaps "08:30-09:15"; touching ends (08:45/08:45) do not. */
const overlaps = (a: { startTime: string; endTime: string }, b: { startTime: string; endTime: string }) =>
  a.startTime < b.endTime && b.startTime < a.endTime;

interface SlotContext {
  assignmentId: string | null; // null while creating
  shiftId: string;
  teacherId: string;
  sectionId: string;
  roomId: string | null;
}

/**
 * Validates a set of weekly slots for one assignment and throws a 409 that
 * names every clash (teacher / section / room double-booking), so the admin
 * can fix them all in one go rather than one error at a time.
 */
export async function assertSlotsFree(ctx: SlotContext, slots: RoutineSlotInput[]): Promise<void> {
  if (slots.length === 0) return;

  const keys = new Set<string>();
  for (const s of slots) {
    const key = `${s.dayOfWeek}:${s.periodId}`;
    if (keys.has(key)) throw AppError.badRequest("DUPLICATE_SLOT", "The same day and period was selected twice.");
    keys.add(key);
  }

  const periodIds = Array.from(new Set(slots.map((s) => s.periodId)));
  const periods = await prisma.period.findMany({ where: { id: { in: periodIds } } });
  const periodById = new Map(periods.map((p) => [p.id, p]));
  for (const id of periodIds) {
    const p = periodById.get(id);
    if (!p) throw AppError.badRequest("PERIOD_NOT_FOUND", "One of the selected periods does not exist.");
    if (p.shiftId !== ctx.shiftId) {
      throw AppError.badRequest("PERIOD_WRONG_SHIFT", `"${p.name}" belongs to a different shift than this class.`);
    }
    if (p.isBreak) throw AppError.badRequest("PERIOD_IS_BREAK", `"${p.name}" is a break; classes cannot be scheduled in it.`);
  }

  const days = Array.from(new Set(slots.map((s) => s.dayOfWeek)));
  const others = await prisma.routineSlot.findMany({
    where: { dayOfWeek: { in: days }, ...(ctx.assignmentId ? { assignmentId: { not: ctx.assignmentId } } : {}) },
    include: {
      period: true,
      assignment: { include: { section: { include: { room: true } }, subject: true, teacher: { include: { user: true } }, room: true } },
    },
  });

  const clashes: string[] = [];
  for (const mine of slots) {
    const myPeriod = periodById.get(mine.periodId)!;
    for (const other of others) {
      if (other.dayOfWeek !== mine.dayOfWeek || !overlaps(myPeriod, other.period)) continue;
      const a = other.assignment;
      const when = `${mine.dayOfWeek.toUpperCase()} ${myPeriod.name}`;
      if (a.teacherId === ctx.teacherId) {
        clashes.push(`${when}: ${a.teacher.user.name} already teaches ${a.subject.name} to section ${a.section.name}.`);
      }
      if (a.sectionId === ctx.sectionId) {
        clashes.push(`${when}: section ${a.section.name} already has ${a.subject.name} with ${a.teacher.user.name}.`);
      }
      const otherRoom = a.roomId ?? a.section.roomId;
      if (ctx.roomId && otherRoom === ctx.roomId) {
        const roomName = (a.room ?? a.section.room)?.name ?? "selected room";
        clashes.push(`${when}: ${roomName} is already used by ${a.subject.name} (section ${a.section.name}).`);
      }
    }
  }
  if (clashes.length > 0) {
    const unique = Array.from(new Set(clashes));
    throw new AppError("ROUTINE_CLASH", `Schedule conflict: ${unique[0]}${unique.length > 1 ? ` (+${unique.length - 1} more)` : ""}`, 409, {
      clashes: unique,
    });
  }
}

/** Replaces all of an assignment's slots (caller has already run assertSlotsFree). */
export async function replaceSlots(
  tx: Prisma.TransactionClient,
  assignmentId: string,
  slots: RoutineSlotInput[]
): Promise<void> {
  await tx.routineSlot.deleteMany({ where: { assignmentId } });
  for (const s of slots) {
    await tx.routineSlot.create({ data: { assignmentId, dayOfWeek: s.dayOfWeek, periodId: s.periodId } });
  }
}

/** Only one assignment per section may be flagged as the attendance taker. */
export async function setSectionAttendanceFlag(
  tx: Prisma.TransactionClient,
  sectionId: string,
  assignmentId: string
): Promise<void> {
  await tx.classAssignment.updateMany({
    where: { sectionId, id: { not: assignmentId } },
    data: { takesAttendance: false },
  });
}

export async function buildRoutine(where: Prisma.RoutineSlotWhereInput) {
  const slots = await prisma.routineSlot.findMany({
    where,
    include: {
      period: true,
      assignment: {
        include: { section: { include: { class: true, room: true } }, subject: true, teacher: { include: { user: true } }, room: true },
      },
    },
  });
  const entries: RoutineEntryDto[] = slots.map((s) => ({
    id: s.id,
    assignmentId: s.assignmentId,
    dayOfWeek: s.dayOfWeek as Weekday,
    periodId: s.periodId,
    shiftId: s.period.shiftId,
    sectionId: s.assignment.sectionId,
    sectionName: s.assignment.section.name,
    className: s.assignment.section.class.name,
    subjectName: s.assignment.subject.name,
    teacherName: s.assignment.teacher.user.name,
    roomName: (s.assignment.room ?? s.assignment.section.room)?.name ?? null,
  }));
  return entries;
}
