import type { Request, Response } from "express";
import {
  submitAttendanceSchema,
  attendanceQuerySchema,
  setAttendanceTakerSchema,
} from "@packages/shared-types";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { assertSectionAccess, getTeacherId } from "../lib/scope";
import * as attendanceService from "../services/attendance.service";

export async function submitAttendance(req: Request, res: Response) {
  const input = submitAttendanceSchema.parse(req.body);

  // Only the delegated taker (or an admin/coordinator) may submit for this
  // section (lms-domain.md: "assignable taker ... delegated by admin").
  if (req.user!.role === "teacher") {
    const taker = await attendanceService.resolveAttendanceTaker(input.sectionId);
    if (!taker || taker.userId !== req.user!.id) {
      throw AppError.forbidden("You are not the assigned attendance taker for this section.");
    }
  }

  const takenById =
    req.user!.role === "teacher"
      ? (await prisma.teacher.findUnique({ where: { userId: req.user!.id } }))?.id ?? null
      : null;

  await attendanceService.submitAttendance(input, takenById);
  res.status(204).send();
}

export async function getAttendance(req: Request, res: Response) {
  const { sectionId, date } = attendanceQuerySchema.parse(req.query);
  await assertSectionAccess(req.user!, sectionId);
  const items = await attendanceService.listAttendance(sectionId, date);
  res.json({ items });
}

export async function setAttendanceTaker(req: Request, res: Response) {
  const input = setAttendanceTakerSchema.parse(req.body);
  const teacher = await prisma.teacher.findUnique({ where: { id: input.teacherId } });
  if (!teacher) throw AppError.badRequest("TEACHER_NOT_FOUND", "That teacher does not exist.");
  const section = await prisma.section.findUnique({ where: { id: input.sectionId } });
  if (!section) throw AppError.badRequest("SECTION_NOT_FOUND", "That section does not exist.");

  await prisma.section.update({
    where: { id: input.sectionId },
    data: { attendanceTakerId: input.teacherId },
  });
  res.status(204).send();
}

export async function mySections(req: Request, res: Response) {
  const teacherId = await getTeacherId(req.user!.id);
  // The browser sends its own local calendar date so "today" is right in Dhaka (UTC+6), not just in UTC.
  const q = typeof req.query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date) ? req.query.date : null;
  const date = q ? new Date(`${q}T00:00:00.000Z`) : undefined;
  res.json({ items: teacherId ? await attendanceService.sectionsTakenBy(teacherId, date) : [] });
}
