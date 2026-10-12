import type { Request, Response } from "express";
import {
  upsertShiftSchema,
  createClassSchema,
  updateClassSchema,
  createSectionSchema,
  updateSectionSchema,
  upsertBuildingSchema,
  createRoomSchema,
  updateRoomSchema,
  createPeriodSchema,
  createAcademicYearSchema,
  type ShiftDto,
  type ClassDto,
  type SectionDto,
  type BuildingDto,
  type RoomDto,
  type AcademicYearDto,
} from "@packages/shared-types";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { getSchoolId } from "../lib/school";
import { toPeriodDto } from "../services/routine.service";

/**
 * Admin CRUD for the academic structure: shifts, classes, sections,
 * buildings (optional), rooms, bell-schedule periods and academic years.
 * Deletes are soft wherever the table has `deletedAt`, and are refused
 * (409) while something still depends on the record, with a message that
 * says what to remove first.
 */

const mustExist = <T>(row: T | null, what: string): T => {
  if (!row) throw AppError.notFound(`${what} not found.`);
  return row;
};
const parseDate = (d: string) => new Date(`${d}T00:00:00.000Z`);

// --- Shifts -----------------------------------------------------------------

const toShift = (s: { id: string; name: string }): ShiftDto => ({ id: s.id, name: s.name });

export async function listShifts(_req: Request, res: Response) {
  const rows = await prisma.shift.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } });
  res.json({ items: rows.map(toShift) });
}
export async function createShift(req: Request, res: Response) {
  const input = upsertShiftSchema.parse(req.body);
  const schoolId = await getSchoolId();
  const dup = await prisma.shift.findFirst({ where: { schoolId, name: input.name, deletedAt: null } });
  if (dup) throw AppError.conflict(`A shift called "${input.name}" already exists.`);
  const row = await prisma.shift.create({ data: { name: input.name, schoolId } });
  res.status(201).json({ shift: toShift(row) });
}
export async function updateShift(req: Request, res: Response) {
  const input = upsertShiftSchema.parse(req.body);
  mustExist(await prisma.shift.findFirst({ where: { id: req.params.id, deletedAt: null } }), "Shift");
  const row = await prisma.shift.update({ where: { id: req.params.id }, data: { name: input.name } });
  res.json({ shift: toShift(row) });
}
export async function deleteShift(req: Request, res: Response) {
  mustExist(await prisma.shift.findFirst({ where: { id: req.params.id, deletedAt: null } }), "Shift");
  const classes = await prisma.class.count({ where: { shiftId: req.params.id, deletedAt: null } });
  if (classes > 0) throw AppError.conflict("Classes still run in this shift. Move or delete them first.");
  const periods = await prisma.period.count({ where: { shiftId: req.params.id } });
  if (periods > 0) throw AppError.conflict("This shift still has periods. Delete them first.");
  await prisma.shift.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
  res.status(204).send();
}

// --- Classes ----------------------------------------------------------------

async function classDto(id: string): Promise<ClassDto> {
  const c = mustExist(
    await prisma.class.findFirst({ where: { id, deletedAt: null }, include: { shift: true, sections: { where: { deletedAt: null } } } }),
    "Class"
  );
  return { id: c.id, name: c.name, shiftId: c.shiftId, shiftName: c.shift.name, sectionCount: c.sections.length };
}

export async function listClasses(_req: Request, res: Response) {
  const rows = await prisma.class.findMany({
    where: { deletedAt: null },
    include: { shift: true, sections: { where: { deletedAt: null } } },
    orderBy: { name: "asc" },
  });
  const items: ClassDto[] = rows.map((c) => ({
    id: c.id,
    name: c.name,
    shiftId: c.shiftId,
    shiftName: c.shift.name,
    sectionCount: c.sections.length,
  }));
  res.json({ items });
}
export async function createClass(req: Request, res: Response) {
  const input = createClassSchema.parse(req.body);
  const schoolId = await getSchoolId();
  mustExist(await prisma.shift.findFirst({ where: { id: input.shiftId, deletedAt: null } }), "Shift");
  const dup = await prisma.class.findFirst({ where: { schoolId, name: input.name, deletedAt: null } });
  if (dup) throw AppError.conflict(`A class called "${input.name}" already exists.`);
  const row = await prisma.class.create({ data: { name: input.name, shiftId: input.shiftId, schoolId } });
  res.status(201).json({ class: await classDto(row.id) });
}
export async function updateClass(req: Request, res: Response) {
  const input = updateClassSchema.parse(req.body);
  const existing = mustExist(await prisma.class.findFirst({ where: { id: req.params.id, deletedAt: null } }), "Class");
  if (input.shiftId && input.shiftId !== existing.shiftId) {
    mustExist(await prisma.shift.findFirst({ where: { id: input.shiftId, deletedAt: null } }), "Shift");
    // Existing weekly slots point at periods of the OLD shift; moving the
    // class would leave them stranded, so require the routine to be cleared.
    const assigned = await prisma.classAssignment.count({ where: { classId: existing.id } });
    if (assigned > 0) throw AppError.conflict("Remove this class's teacher assignments before moving it to another shift.");
  }
  await prisma.class.update({ where: { id: existing.id }, data: input });
  res.json({ class: await classDto(existing.id) });
}
export async function deleteClass(req: Request, res: Response) {
  const existing = mustExist(await prisma.class.findFirst({ where: { id: req.params.id, deletedAt: null } }), "Class");
  const sections = await prisma.section.count({ where: { classId: existing.id, deletedAt: null } });
  if (sections > 0) throw AppError.conflict("This class still has sections. Delete them first.");
  const subjects = await prisma.subject.count({ where: { classId: existing.id, deletedAt: null } });
  if (subjects > 0) throw AppError.conflict("This class still has subjects. Delete them first.");
  await prisma.class.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
  res.status(204).send();
}

// --- Sections ---------------------------------------------------------------

async function sectionDto(id: string): Promise<SectionDto> {
  const s = mustExist(
    await prisma.section.findFirst({
      where: { id, deletedAt: null },
      include: { class: true, room: true, students: { where: { deletedAt: null } } },
    }),
    "Section"
  );
  return {
    id: s.id,
    name: s.name,
    classId: s.classId,
    className: s.class.name,
    roomId: s.roomId,
    roomName: s.room?.name ?? null,
    studentCount: s.students.length,
  };
}

export async function listSections(req: Request, res: Response) {
  const classId = typeof req.query.classId === "string" ? req.query.classId : undefined;
  const rows = await prisma.section.findMany({
    where: { deletedAt: null, ...(classId ? { classId } : {}) },
    include: { class: true, room: true, students: { where: { deletedAt: null } } },
    orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
  });
  const items: SectionDto[] = rows.map((s) => ({
    id: s.id,
    name: s.name,
    classId: s.classId,
    className: s.class.name,
    roomId: s.roomId,
    roomName: s.room?.name ?? null,
    studentCount: s.students.length,
  }));
  res.json({ items });
}
export async function createSection(req: Request, res: Response) {
  const input = createSectionSchema.parse(req.body);
  mustExist(await prisma.class.findFirst({ where: { id: input.classId, deletedAt: null } }), "Class");
  if (input.roomId) mustExist(await prisma.room.findFirst({ where: { id: input.roomId, deletedAt: null } }), "Room");
  const dup = await prisma.section.findFirst({ where: { classId: input.classId, name: input.name, deletedAt: null } });
  if (dup) throw AppError.conflict(`This class already has a section "${input.name}".`);
  const row = await prisma.section.create({
    data: { name: input.name, classId: input.classId, roomId: input.roomId ?? null },
  });
  res.status(201).json({ section: await sectionDto(row.id) });
}
export async function updateSection(req: Request, res: Response) {
  const input = updateSectionSchema.parse(req.body);
  const existing = mustExist(await prisma.section.findFirst({ where: { id: req.params.id, deletedAt: null } }), "Section");
  if (input.classId && input.classId !== existing.classId) {
    throw AppError.badRequest("SECTION_CLASS_FIXED", "A section cannot be moved to another class. Create a new one instead.");
  }
  if (input.roomId) mustExist(await prisma.room.findFirst({ where: { id: input.roomId, deletedAt: null } }), "Room");
  if (input.name && input.name !== existing.name) {
    const dup = await prisma.section.findFirst({ where: { classId: existing.classId, name: input.name, deletedAt: null } });
    if (dup) throw AppError.conflict(`This class already has a section "${input.name}".`);
  }
  await prisma.section.update({
    where: { id: existing.id },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(input.roomId !== undefined ? { roomId: input.roomId } : {}),
    },
  });
  res.json({ section: await sectionDto(existing.id) });
}
export async function deleteSection(req: Request, res: Response) {
  const existing = mustExist(await prisma.section.findFirst({ where: { id: req.params.id, deletedAt: null } }), "Section");
  const students = await prisma.student.count({ where: { sectionId: existing.id, deletedAt: null } });
  if (students > 0) throw AppError.conflict("Students are still enrolled in this section. Move them first.");
  const assigned = await prisma.classAssignment.count({ where: { sectionId: existing.id } });
  if (assigned > 0) throw AppError.conflict("This section still has teacher assignments. Remove them first.");
  await prisma.section.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
  res.status(204).send();
}

// --- Buildings (optional) ---------------------------------------------------

/** Buildings hang off a Campus in the schema; a one-campus school never needs
 * to know that, so the default campus is created on first use. */
async function defaultCampusId(): Promise<string> {
  const schoolId = await getSchoolId();
  const existing = await prisma.campus.findFirst({ where: { schoolId, deletedAt: null }, orderBy: { createdAt: "asc" } });
  if (existing) return existing.id;
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  const created = await prisma.campus.create({ data: { name: school?.name ?? "Main campus", schoolId } });
  return created.id;
}

const toBuilding = (b: { id: string; name: string; rooms: unknown[] }): BuildingDto => ({
  id: b.id,
  name: b.name,
  roomCount: b.rooms.length,
});

export async function listBuildings(_req: Request, res: Response) {
  const rows = await prisma.building.findMany({
    where: { deletedAt: null },
    include: { rooms: { where: { deletedAt: null } } },
    orderBy: { name: "asc" },
  });
  res.json({ items: rows.map(toBuilding) });
}
export async function createBuilding(req: Request, res: Response) {
  const input = upsertBuildingSchema.parse(req.body);
  const campusId = await defaultCampusId();
  const dup = await prisma.building.findFirst({ where: { campusId, name: input.name, deletedAt: null } });
  if (dup) throw AppError.conflict(`A building called "${input.name}" already exists.`);
  const row = await prisma.building.create({ data: { name: input.name, campusId }, include: { rooms: true } });
  res.status(201).json({ building: toBuilding(row) });
}
export async function updateBuilding(req: Request, res: Response) {
  const input = upsertBuildingSchema.parse(req.body);
  mustExist(await prisma.building.findFirst({ where: { id: req.params.id, deletedAt: null } }), "Building");
  const row = await prisma.building.update({
    where: { id: req.params.id },
    data: { name: input.name },
    include: { rooms: { where: { deletedAt: null } } },
  });
  res.json({ building: toBuilding(row) });
}
export async function deleteBuilding(req: Request, res: Response) {
  mustExist(await prisma.building.findFirst({ where: { id: req.params.id, deletedAt: null } }), "Building");
  const rooms = await prisma.room.count({ where: { buildingId: req.params.id, deletedAt: null } });
  if (rooms > 0) throw AppError.conflict("This building still has rooms. Delete or move them first.");
  await prisma.building.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
  res.status(204).send();
}

// --- Rooms ------------------------------------------------------------------

async function roomDto(id: string): Promise<RoomDto> {
  const r = mustExist(await prisma.room.findFirst({ where: { id, deletedAt: null }, include: { building: true } }), "Room");
  return { id: r.id, name: r.name, capacity: r.capacity, buildingId: r.buildingId, buildingName: r.building?.name ?? null };
}

export async function listRooms(_req: Request, res: Response) {
  const rows = await prisma.room.findMany({ where: { deletedAt: null }, include: { building: true }, orderBy: { name: "asc" } });
  const items: RoomDto[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    capacity: r.capacity,
    buildingId: r.buildingId,
    buildingName: r.building?.name ?? null,
  }));
  res.json({ items });
}
export async function createRoom(req: Request, res: Response) {
  const input = createRoomSchema.parse(req.body);
  if (input.buildingId) mustExist(await prisma.building.findFirst({ where: { id: input.buildingId, deletedAt: null } }), "Building");
  const dup = await prisma.room.findFirst({
    where: { name: input.name, buildingId: input.buildingId ?? null, deletedAt: null },
  });
  if (dup) throw AppError.conflict(`A room called "${input.name}" already exists there.`);
  const row = await prisma.room.create({
    data: { name: input.name, capacity: input.capacity ?? null, buildingId: input.buildingId ?? null },
  });
  res.status(201).json({ room: await roomDto(row.id) });
}
export async function updateRoom(req: Request, res: Response) {
  const input = updateRoomSchema.parse(req.body);
  const existing = mustExist(await prisma.room.findFirst({ where: { id: req.params.id, deletedAt: null } }), "Room");
  if (input.buildingId) mustExist(await prisma.building.findFirst({ where: { id: input.buildingId, deletedAt: null } }), "Building");
  await prisma.room.update({
    where: { id: existing.id },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
      ...(input.buildingId !== undefined ? { buildingId: input.buildingId } : {}),
    },
  });
  res.json({ room: await roomDto(existing.id) });
}
export async function deleteRoom(req: Request, res: Response) {
  const existing = mustExist(await prisma.room.findFirst({ where: { id: req.params.id, deletedAt: null } }), "Room");
  const sections = await prisma.section.count({ where: { roomId: existing.id, deletedAt: null } });
  const assignments = await prisma.classAssignment.count({ where: { roomId: existing.id } });
  if (sections + assignments > 0) throw AppError.conflict("This room is in use by a section or a class assignment. Reassign it first.");
  await prisma.room.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
  res.status(204).send();
}

// --- Periods (bell schedule) ------------------------------------------------

export async function listPeriods(req: Request, res: Response) {
  const shiftId = typeof req.query.shiftId === "string" ? req.query.shiftId : undefined;
  const rows = await prisma.period.findMany({
    where: shiftId ? { shiftId } : {},
    orderBy: [{ sortOrder: "asc" }, { startTime: "asc" }],
  });
  res.json({ items: rows.map(toPeriodDto) });
}
async function assertNoPeriodOverlap(shiftId: string, startTime: string, endTime: string, ignoreId?: string) {
  const siblings = await prisma.period.findMany({ where: { shiftId, ...(ignoreId ? { id: { not: ignoreId } } : {}) } });
  const clash = siblings.find((p) => startTime < p.endTime && p.startTime < endTime);
  if (clash) {
    throw AppError.conflict(`Overlaps "${clash.name}" (${clash.startTime}–${clash.endTime}) in the same shift.`);
  }
}
export async function createPeriod(req: Request, res: Response) {
  const input = createPeriodSchema.parse(req.body);
  mustExist(await prisma.shift.findFirst({ where: { id: input.shiftId, deletedAt: null } }), "Shift");
  await assertNoPeriodOverlap(input.shiftId, input.startTime, input.endTime);
  const siblings = await prisma.period.count({ where: { shiftId: input.shiftId } });
  const row = await prisma.period.create({
    data: {
      name: input.name,
      shiftId: input.shiftId,
      startTime: input.startTime,
      endTime: input.endTime,
      isBreak: input.isBreak ?? false,
      sortOrder: input.sortOrder ?? siblings + 1,
    },
  });
  res.status(201).json({ period: toPeriodDto(row) });
}
export async function updatePeriod(req: Request, res: Response) {
  const input = createPeriodSchema.parse(req.body);
  const existing = mustExist(await prisma.period.findUnique({ where: { id: req.params.id } }), "Period");
  if (input.shiftId !== existing.shiftId) {
    throw AppError.badRequest("PERIOD_SHIFT_FIXED", "A period cannot move to another shift. Create a new one instead.");
  }
  await assertNoPeriodOverlap(existing.shiftId, input.startTime, input.endTime, existing.id);
  if (input.isBreak) {
    const used = await prisma.routineSlot.count({ where: { periodId: existing.id } });
    if (used > 0) throw AppError.conflict("Classes are scheduled in this period, so it cannot become a break.");
  }
  const row = await prisma.period.update({
    where: { id: existing.id },
    data: {
      name: input.name,
      startTime: input.startTime,
      endTime: input.endTime,
      isBreak: input.isBreak ?? false,
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
  });
  res.json({ period: toPeriodDto(row) });
}
export async function deletePeriod(req: Request, res: Response) {
  const existing = mustExist(await prisma.period.findUnique({ where: { id: req.params.id } }), "Period");
  const used = await prisma.routineSlot.count({ where: { periodId: existing.id } });
  if (used > 0) throw AppError.conflict("Classes are scheduled in this period. Remove them from the routine first.");
  await prisma.period.delete({ where: { id: existing.id } });
  res.status(204).send();
}

// --- Academic years ---------------------------------------------------------

const toYear = (y: { id: string; name: string; startDate: Date; endDate: Date; isCurrent: boolean }): AcademicYearDto => ({
  id: y.id,
  name: y.name,
  startDate: y.startDate.toISOString().slice(0, 10),
  endDate: y.endDate.toISOString().slice(0, 10),
  isCurrent: y.isCurrent,
});

export async function listAcademicYears(_req: Request, res: Response) {
  const rows = await prisma.academicYear.findMany({ orderBy: { startDate: "desc" } });
  res.json({ items: rows.map(toYear) });
}
export async function createAcademicYear(req: Request, res: Response) {
  const input = createAcademicYearSchema.parse(req.body);
  const schoolId = await getSchoolId();
  const row = await prisma.$transaction(async (tx) => {
    // Exactly one year can be "current".
    if (input.isCurrent) await tx.academicYear.updateMany({ where: { schoolId, isCurrent: true }, data: { isCurrent: false } });
    return tx.academicYear.create({
      data: {
        name: input.name,
        schoolId,
        startDate: parseDate(input.startDate),
        endDate: parseDate(input.endDate),
        isCurrent: input.isCurrent ?? false,
      },
    });
  });
  res.status(201).json({ year: toYear(row) });
}
export async function setCurrentAcademicYear(req: Request, res: Response) {
  const existing = mustExist(await prisma.academicYear.findUnique({ where: { id: req.params.id } }), "Academic year");
  await prisma.$transaction(async (tx) => {
    await tx.academicYear.updateMany({ where: { schoolId: existing.schoolId, isCurrent: true }, data: { isCurrent: false } });
    await tx.academicYear.update({ where: { id: existing.id }, data: { isCurrent: true } });
  });
  const rows = await prisma.academicYear.findMany({ orderBy: { startDate: "desc" } });
  res.json({ items: rows.map(toYear) });
}
export async function deleteAcademicYear(req: Request, res: Response) {
  const existing = mustExist(await prisma.academicYear.findUnique({ where: { id: req.params.id } }), "Academic year");
  if (existing.isCurrent) throw AppError.conflict("Make another year current before deleting this one.");
  await prisma.academicYear.delete({ where: { id: existing.id } });
  res.status(204).send();
}
