import type { Request, Response } from "express";
import {
  createSubjectSchema,
  updateSubjectSchema,
  createClassAssignmentSchema,
  updateClassAssignmentSchema,
  type SubjectDto,
  type Weekday,
} from "@packages/shared-types";
import {
  assertSlotsFree,
  assignmentInclude,
  buildRoutine,
  replaceSlots,
  setSectionAttendanceFlag,
  toAssignmentDto,
  toPeriodDto,
} from "../services/routine.service";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { assertSectionAccess, getTeacherId, resolveSectionFilter } from "../lib/scope";

// --- Subjects ---

export async function listSubjects(req: Request, res: Response) {
  const classId = typeof req.query.classId === "string" ? req.query.classId : undefined;
  const subjects = await prisma.subject.findMany({
    where: { deletedAt: null, ...(classId ? { classId } : {}) },
    orderBy: { name: "asc" },
  });
  const items: SubjectDto[] = subjects.map((s) => ({ id: s.id, name: s.name, classId: s.classId }));
  res.json({ items });
}

export async function createSubject(req: Request, res: Response) {
  const input = createSubjectSchema.parse(req.body);
  const cls = await prisma.class.findFirst({ where: { id: input.classId, deletedAt: null } });
  if (!cls) throw AppError.badRequest("CLASS_NOT_FOUND", "That class does not exist.");
  const dup = await prisma.subject.findFirst({ where: { classId: input.classId, name: input.name, deletedAt: null } });
  if (dup) throw AppError.conflict(`${cls.name} already has a subject called "${input.name}".`);
  const subject = await prisma.subject.create({ data: input });
  res.status(201).json({ subject: { id: subject.id, name: subject.name, classId: subject.classId } });
}

export async function updateSubject(req: Request, res: Response) {
  const input = updateSubjectSchema.parse(req.body);
  const existing = await prisma.subject.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!existing) throw AppError.notFound("Subject not found.");
  const subject = await prisma.subject.update({ where: { id: existing.id }, data: input });
  res.json({ subject: { id: subject.id, name: subject.name, classId: subject.classId } });
}

export async function deleteSubject(req: Request, res: Response) {
  const existing = await prisma.subject.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!existing) throw AppError.notFound("Subject not found.");
  const inUse = await prisma.classAssignment.count({ where: { subjectId: existing.id } });
  if (inUse > 0) throw AppError.conflict("This subject is assigned to a teacher. Remove those assignments first.");
  await prisma.subject.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
  res.status(204).send();
}

// --- Class assignments ---

export async function listClassAssignments(req: Request, res: Response) {
  const requestedSection = typeof req.query.sectionId === "string" ? req.query.sectionId : undefined;
  let teacherId = typeof req.query.teacherId === "string" ? req.query.teacherId : undefined;

  // Teachers only ever see their own assignments; student/parent only their
  // own sections' timetable. Query params can narrow, never widen, the scope.
  if (req.user!.role === "teacher" || req.query.mine === "true") {
    teacherId = (await getTeacherId(req.user!.id)) ?? "__none__";
  }
  // A teacher is already confined by teacherId above; everyone else goes
  // through the shared section scope (admin-tier unrestricted).
  const sectionId =
    req.user!.role === "teacher" ? requestedSection : await resolveSectionFilter(req.user!, requestedSection);

  const rows = await prisma.classAssignment.findMany({
    where: { ...(sectionId ? { sectionId } : {}), ...(teacherId ? { teacherId } : {}) },
    include: assignmentInclude,
    orderBy: { createdAt: "desc" },
  });
  res.json({ items: rows.map(toAssignmentDto) });
}

export async function createClassAssignment(req: Request, res: Response) {
  const input = createClassAssignmentSchema.parse(req.body);

  // Resolve and cross-check every reference so a mismatched payload (a
  // subject from another class, a section of a different class) can't
  // create an assignment that no screen could ever display.
  const section = await prisma.section.findFirst({ where: { id: input.sectionId, deletedAt: null }, include: { class: true } });
  if (!section) throw AppError.badRequest("SECTION_NOT_FOUND", "That section does not exist.");
  if (input.classId && input.classId !== section.classId) {
    throw AppError.badRequest("SECTION_CLASS_MISMATCH", "That section does not belong to the selected class.");
  }
  const shiftId = input.shiftId ?? section.class.shiftId;
  if (shiftId !== section.class.shiftId) {
    throw AppError.badRequest("SHIFT_MISMATCH", "That class runs in a different shift.");
  }
  const subject = await prisma.subject.findFirst({ where: { id: input.subjectId, deletedAt: null } });
  if (!subject || subject.classId !== section.classId) {
    throw AppError.badRequest("SUBJECT_CLASS_MISMATCH", "That subject is not taught in this class.");
  }
  const teacher = await prisma.teacher.findFirst({ where: { id: input.teacherId, deletedAt: null } });
  if (!teacher) throw AppError.badRequest("TEACHER_NOT_FOUND", "That teacher does not exist.");
  if (input.roomId) {
    const room = await prisma.room.findFirst({ where: { id: input.roomId, deletedAt: null } });
    if (!room) throw AppError.badRequest("ROOM_NOT_FOUND", "That room does not exist.");
  }

  const existing = await prisma.classAssignment.findUnique({
    where: { sectionId_subjectId: { sectionId: input.sectionId, subjectId: input.subjectId } },
  });
  if (existing) {
    throw AppError.conflict("This section already has an instructor assigned for this subject.");
  }

  const slots = input.slots ?? [];
  await assertSlotsFree(
    { assignmentId: null, shiftId, teacherId: input.teacherId, sectionId: input.sectionId, roomId: input.roomId ?? section.roomId },
    slots
  );

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.classAssignment.create({
      data: {
        shiftId,
        classId: section.classId,
        sectionId: input.sectionId,
        subjectId: input.subjectId,
        teacherId: input.teacherId,
        roomId: input.roomId ?? null,
        takesAttendance: input.takesAttendance ?? false,
      },
    });
    if (input.takesAttendance) await setSectionAttendanceFlag(tx, input.sectionId, row.id);
    await replaceSlots(tx, row.id, slots);
    return row;
  });

  const full = await prisma.classAssignment.findUnique({ where: { id: created.id }, include: assignmentInclude });
  res.status(201).json({ assignment: toAssignmentDto(full!) });
}

export async function updateClassAssignment(req: Request, res: Response) {
  const input = updateClassAssignmentSchema.parse(req.body);
  const existing = await prisma.classAssignment.findUnique({
    where: { id: req.params.id },
    include: { section: true, slots: true },
  });
  if (!existing) throw AppError.notFound("Assignment not found.");

  if (input.teacherId) {
    const teacher = await prisma.teacher.findFirst({ where: { id: input.teacherId, deletedAt: null } });
    if (!teacher) throw AppError.badRequest("TEACHER_NOT_FOUND", "That teacher does not exist.");
  }
  if (input.roomId) {
    const room = await prisma.room.findFirst({ where: { id: input.roomId, deletedAt: null } });
    if (!room) throw AppError.badRequest("ROOM_NOT_FOUND", "That room does not exist.");
  }

  const teacherId = input.teacherId ?? existing.teacherId;
  const roomId = input.roomId === undefined ? existing.roomId : input.roomId;
  // Changing the teacher or room re-validates the EXISTING slots too, not
  // just newly supplied ones — otherwise a swap could silently double-book.
  const slots =
    input.slots ?? existing.slots.map((s) => ({ dayOfWeek: s.dayOfWeek as Weekday, periodId: s.periodId }));
  if (input.slots || input.teacherId || input.roomId !== undefined) {
    await assertSlotsFree(
      { assignmentId: existing.id, shiftId: existing.shiftId, teacherId, sectionId: existing.sectionId, roomId: roomId ?? existing.section.roomId },
      slots
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.classAssignment.update({
      where: { id: existing.id },
      data: {
        teacherId,
        roomId,
        ...(input.takesAttendance !== undefined ? { takesAttendance: input.takesAttendance } : {}),
      },
    });
    if (input.takesAttendance) await setSectionAttendanceFlag(tx, existing.sectionId, existing.id);
    if (input.slots) await replaceSlots(tx, existing.id, input.slots);
  });

  const full = await prisma.classAssignment.findUnique({ where: { id: existing.id }, include: assignmentInclude });
  res.json({ assignment: toAssignmentDto(full!) });
}

export async function deleteClassAssignment(req: Request, res: Response) {
  const { id } = req.params;
  const existing = await prisma.classAssignment.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("Assignment not found.");
  await prisma.$transaction(async (tx) => {
    await tx.routineSlot.deleteMany({ where: { assignmentId: id } });
    await tx.classAssignment.delete({ where: { id } });
  });
  res.status(204).send();
}

// --- Routine (derived from assignment slots) ---

/**
 * Who sees what: admin-tier any section/teacher; a teacher only their own
 * periods; student/parent only their own sections. Query params can narrow
 * the scope, never widen it (same rule as listClassAssignments).
 */
export async function getRoutine(req: Request, res: Response) {
  const requestedSection = typeof req.query.sectionId === "string" ? req.query.sectionId : undefined;
  let teacherId = typeof req.query.teacherId === "string" ? req.query.teacherId : undefined;
  const isGuardian = req.user!.role === "student" || req.user!.role === "parent";
  // "mine" means "my teaching periods" for staff; for a student/parent it is
  // already implied by the section scope below, so it must not zero the result.
  if (req.user!.role === "teacher" || (req.query.mine === "true" && !isGuardian)) {
    teacherId = (await getTeacherId(req.user!.id)) ?? "__none__";
  }

  const assignmentWhere: Record<string, unknown> = {};
  if (teacherId) assignmentWhere.teacherId = teacherId;
  if (req.user!.role !== "teacher") {
    const sectionFilter = await resolveSectionFilter(req.user!, requestedSection);
    if (sectionFilter) assignmentWhere.sectionId = sectionFilter;
  } else if (requestedSection) {
    assignmentWhere.sectionId = requestedSection;
  }

  const entries = await buildRoutine({ assignment: assignmentWhere });
  const shiftIds = Array.from(new Set(entries.map((e) => e.shiftId)));

  // With no entries yet, still return the periods of the requested
  // section's shift so the UI can draw an empty grid.
  let periodShiftIds = shiftIds;
  if (periodShiftIds.length === 0 && requestedSection) {
    const section = await prisma.section.findUnique({ where: { id: requestedSection }, include: { class: true } });
    if (section) periodShiftIds = [section.class.shiftId];
  }
  const periods = periodShiftIds.length
    ? await prisma.period.findMany({ where: { shiftId: { in: periodShiftIds } }, orderBy: { sortOrder: "asc" } })
    : [];

  res.json({ periods: periods.map(toPeriodDto), entries });
}

// --- Section roster (for attendance-taking) ---

export async function getSectionRoster(req: Request, res: Response) {
  const { id } = req.params;
  await assertSectionAccess(req.user!, id);
  const students = await prisma.student.findMany({
    where: { sectionId: id, deletedAt: null },
    include: { user: true },
    orderBy: { rollNumber: "asc" },
  });
  res.json({
    items: students.map((s) => ({ id: s.id, name: s.user.name, rollNumber: s.rollNumber })),
  });
}
