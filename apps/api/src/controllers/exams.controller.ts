import type { Request, Response } from "express";
import {
  createExamSchema,
  submitMarksSchema,
  publishExamSchema,
  type ExamDto,
  type MarkDto,
} from "@packages/shared-types";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import {
  isAcademicAdmin,
  isGuardianRole,
  ownStudentIds,
  resolveSectionFilter,
  teacherTeachesSubjectInSection,
  teacherTeachingWhere,
} from "../lib/scope";
import * as examsService from "../services/exams.service";

function toExamDto(row: {
  id: string;
  name: string;
  type: string;
  subjectId: string;
  subject: { name: string };
  sectionId: string;
  section: { name: string };
  examDate: Date;
  maxMarks: number;
  publishedAt: Date | null;
}): ExamDto {
  return {
    id: row.id,
    name: row.name,
    type: row.type as ExamDto["type"],
    subjectId: row.subjectId,
    subjectName: row.subject.name,
    sectionId: row.sectionId,
    sectionName: row.section.name,
    examDate: row.examDate.toISOString().slice(0, 10),
    maxMarks: row.maxMarks,
    publishedAt: row.publishedAt?.toISOString() ?? null,
  };
}

/** Teachers may only touch exams for a subject they teach in that section;
 * admin-tier roles are unrestricted. */
async function assertExamStaffAccess(req: Request, exam: { sectionId: string; subjectId: string }) {
  if (isAcademicAdmin(req.user!)) return;
  if (req.user!.role !== "teacher") throw AppError.forbidden();
  const ok = await teacherTeachesSubjectInSection(req.user!.id, exam.sectionId, exam.subjectId);
  if (!ok) throw AppError.forbidden("You are not assigned to this subject in this section.");
}

export async function listExams(req: Request, res: Response) {
  const requested = typeof req.query.sectionId === "string" ? req.query.sectionId : undefined;
  const sectionId = await resolveSectionFilter(req.user!, requested);
  const guardian = isGuardianRole(req.user!);
  // Teachers see only exams for subjects they teach in that section.
  const teaching = req.user!.role === "teacher" ? await teacherTeachingWhere(req.user!.id) : {};

  const rows = await prisma.exam.findMany({
    where: {
      deletedAt: null,
      ...teaching,
      ...(sectionId ? { sectionId } : {}),
      ...(guardian ? { publishedAt: { not: null } } : {}),
    },
    include: { subject: true, section: true },
    orderBy: { examDate: "desc" },
  });
  res.json({ items: rows.map(toExamDto) });
}

export async function createExam(req: Request, res: Response) {
  const input = createExamSchema.parse(req.body);

  const [section, subject] = await Promise.all([
    prisma.section.findUnique({ where: { id: input.sectionId } }),
    prisma.subject.findUnique({ where: { id: input.subjectId } }),
  ]);
  if (!section || section.deletedAt) throw AppError.badRequest("SECTION_NOT_FOUND", "That section does not exist.");
  if (!subject || subject.deletedAt) throw AppError.badRequest("SUBJECT_NOT_FOUND", "That subject does not exist.");
  if (subject.classId !== section.classId) {
    throw AppError.badRequest("SUBJECT_CLASS_MISMATCH", "That subject is not taught in this section's class.");
  }
  await assertExamStaffAccess(req, input);

  const row = await prisma.exam.create({
    data: { ...input, examDate: new Date(input.examDate) },
    include: { subject: true, section: true },
  });
  res.status(201).json({ exam: toExamDto(row) });
}

export async function listMarks(req: Request, res: Response) {
  const { examId } = req.params;
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam || exam.deletedAt) throw AppError.notFound("Exam not found.");

  // Student / parent: only their own child's rows, and only once published.
  if (isGuardianRole(req.user!)) {
    if (!exam.publishedAt) return res.json({ items: [] });
    const studentIds = await ownStudentIds(req.user!);
    const rows = await prisma.mark.findMany({
      where: { examId, studentId: { in: studentIds } },
      include: { student: { include: { user: true } } },
    });
    return res.json({ items: rows.map(toMarkDto) });
  }

  await assertExamStaffAccess(req, exam);
  const rows = await prisma.mark.findMany({
    where: { examId },
    include: { student: { include: { user: true } } },
    orderBy: { student: { rollNumber: "asc" } },
  });
  res.json({ items: rows.map(toMarkDto) });
}

function toMarkDto(row: {
  id: string;
  examId: string;
  studentId: string;
  student: { user: { name: string }; rollNumber: string | null };
  marksObtained: number;
  comment: string | null;
}): MarkDto {
  return {
    id: row.id,
    examId: row.examId,
    studentId: row.studentId,
    studentName: row.student.user.name,
    rollNumber: row.student.rollNumber,
    marksObtained: row.marksObtained,
    comment: row.comment,
  };
}

export async function submitMarks(req: Request, res: Response) {
  const input = submitMarksSchema.parse(req.body);
  const exam = await prisma.exam.findUnique({ where: { id: input.examId } });
  if (!exam || exam.deletedAt) throw AppError.notFound("Exam not found.");
  await assertExamStaffAccess(req, exam);
  if (exam.publishedAt) {
    throw AppError.conflict("This exam is already published — marks can no longer be changed.");
  }

  const ids = input.entries.map((e) => e.studentId);
  if (new Set(ids).size !== ids.length) {
    throw AppError.badRequest("DUPLICATE_ENTRIES", "Each student may appear only once.");
  }
  const enrolled = await prisma.student.findMany({
    where: { id: { in: ids }, sectionId: exam.sectionId, deletedAt: null },
  });
  if (enrolled.length !== ids.length) {
    throw AppError.badRequest("STUDENT_NOT_IN_SECTION", "One or more students are not in this exam's section.");
  }
  const over = input.entries.find((e) => e.marksObtained > exam.maxMarks);
  if (over) {
    throw AppError.badRequest("MARKS_EXCEED_MAX", `Marks cannot exceed the exam maximum of ${exam.maxMarks}.`);
  }

  await prisma.$transaction(
    input.entries.map((entry) =>
      prisma.mark.upsert({
        where: { examId_studentId: { examId: input.examId, studentId: entry.studentId } },
        update: { marksObtained: entry.marksObtained, comment: entry.comment },
        create: {
          examId: input.examId,
          studentId: entry.studentId,
          marksObtained: entry.marksObtained,
          comment: entry.comment,
        },
      })
    )
  );
  res.status(204).send();
}

export async function publishExam(req: Request, res: Response) {
  const { examId } = publishExamSchema.parse(req.body);
  const existing = await prisma.exam.findUnique({ where: { id: examId } });
  if (!existing || existing.deletedAt) throw AppError.notFound("Exam not found.");
  await assertExamStaffAccess(req, existing);
  if (existing.publishedAt) throw AppError.conflict("This exam is already published.");
  const exam = await examsService.publishExam(examId);
  res.json({ exam: toExamDto(exam as any) });
}
