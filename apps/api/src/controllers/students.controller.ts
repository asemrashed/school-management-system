import type { Request, Response } from "express";
import { admitStudentSchema, studentListQuerySchema, updateStudentSchema } from "@packages/shared-types";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { admitStudent, nextRollNumber, studentInclude, toStudentDto } from "../services/admission.service";

export async function admit(req: Request, res: Response) {
  const input = admitStudentSchema.parse(req.body);
  res.status(201).json(await admitStudent(input));
}

export async function listStudents(req: Request, res: Response) {
  const { q, sectionId, classId, page, limit } = studentListQuerySchema.parse(req.query);
  const where = {
    deletedAt: null,
    ...(q ? { user: { name: { contains: q, mode: "insensitive" as const } } } : {}),
    ...(sectionId ? { sectionId } : {}),
    ...(classId ? { section: { classId } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.student.findMany({
      where,
      include: studentInclude,
      orderBy: [{ section: { class: { name: "asc" } } }, { rollNumber: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.student.count({ where }),
  ]);
  res.json({ items: rows.map(toStudentDto), total });
}

export async function updateStudent(req: Request, res: Response) {
  const input = updateStudentSchema.parse(req.body);
  const existing = await prisma.student.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!existing) throw AppError.notFound("Student not found.");

  await prisma.$transaction(async (tx) => {
    const data: Record<string, unknown> = {};
    if (input.guardianId) {
      const g = await tx.guardian.findFirst({ where: { id: input.guardianId, deletedAt: null } });
      if (!g) throw AppError.badRequest("GUARDIAN_NOT_FOUND", "That guardian does not exist.");
      data.guardianId = input.guardianId;
    }
    if (input.sectionId && input.sectionId !== existing.sectionId) {
      const section = await tx.section.findFirst({ where: { id: input.sectionId, deletedAt: null } });
      if (!section) throw AppError.badRequest("SECTION_NOT_FOUND", "That section does not exist.");
      data.sectionId = input.sectionId;
      // Moving sections gets a fresh roll number there unless one is given.
      data.rollNumber = input.rollNumber ?? (await nextRollNumber(tx, input.sectionId));
    } else if (input.rollNumber) {
      const clash = await tx.student.findFirst({
        where: { sectionId: existing.sectionId, rollNumber: input.rollNumber, deletedAt: null, id: { not: existing.id } },
      });
      if (clash) throw AppError.conflict(`Roll number ${input.rollNumber} is already taken in this section.`);
      data.rollNumber = input.rollNumber;
    }
    if (Object.keys(data).length) await tx.student.update({ where: { id: existing.id }, data });
    // Deactivating blocks login but keeps every record (fees, marks, attendance).
    if (input.isActive !== undefined) await tx.user.update({ where: { id: existing.userId }, data: { isActive: input.isActive } });
  });

  const full = await prisma.student.findUnique({ where: { id: existing.id }, include: studentInclude });
  res.json({ student: toStudentDto(full!) });
}
