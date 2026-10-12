import type { Request, Response } from "express";
import type { ChildSummaryDto, PerformanceDto } from "@packages/shared-types";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { assertSectionAccess, assertStudentAccess, isGuardianRole, ownStudentIds } from "../lib/scope";

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Parent: their children. Student: just themselves. */
export async function myChildren(req: Request, res: Response) {
  const ids = await ownStudentIds(req.user!);
  const rows = await prisma.student.findMany({
    where: { id: { in: ids }, deletedAt: null },
    include: { user: true, section: { include: { class: true } } },
    orderBy: { rollNumber: "asc" },
  });
  const items: ChildSummaryDto[] = rows.map((r) => ({
    studentId: r.id,
    name: r.user.name,
    className: r.section?.class.name ?? null,
    sectionName: r.section?.name ?? null,
    rollNumber: r.rollNumber,
  }));
  res.json({ items });
}

/**
 * One student's report card. Visible to the student, their parent, the
 * section's teachers and admin-tier staff. Unpublished marks never appear.
 */
export async function getStudentPerformance(req: Request, res: Response) {
  const { id } = req.params;
  const student = await prisma.student.findUnique({
    where: { id },
    include: { user: true, section: { include: { class: true } } },
  });
  if (!student || student.deletedAt) throw AppError.notFound("Student not found.");

  if (isGuardianRole(req.user!)) await assertStudentAccess(req.user!, id);
  else if (student.sectionId) await assertSectionAccess(req.user!, student.sectionId);
  else if (req.user!.role === "teacher") throw AppError.forbidden();

  const [attendance, marks, submissions] = await Promise.all([
    prisma.attendance.findMany({ where: { studentId: id } }),
    prisma.mark.findMany({
      where: { studentId: id, exam: { publishedAt: { not: null }, deletedAt: null } },
      include: { exam: { include: { subject: true } } },
    }),
    prisma.submission.findMany({ where: { studentId: id } }),
  ]);
  const assignmentTotal = student.sectionId
    ? (await prisma.assignment.findMany({ where: { sectionId: student.sectionId, deletedAt: null } })).length
    : 0;

  const present = attendance.filter((a) => a.status === "present").length;
  const late = attendance.filter((a) => a.status === "late").length;
  const absent = attendance.filter((a) => a.status === "absent").length;

  const exams = marks
    .map((m) => ({
      examId: m.examId,
      examName: m.exam.name,
      subjectName: m.exam.subject.name,
      examDate: m.exam.examDate.toISOString().slice(0, 10),
      marksObtained: m.marksObtained,
      maxMarks: m.exam.maxMarks,
      percent: round1((m.marksObtained / m.exam.maxMarks) * 100),
    }))
    .sort((a, b) => b.examDate.localeCompare(a.examDate));

  const bySubject = new Map<string, number[]>();
  for (const e of exams) bySubject.set(e.subjectName, [...(bySubject.get(e.subjectName) ?? []), e.percent]);

  const dto: PerformanceDto = {
    studentId: id,
    studentName: student.user.name,
    className: student.section?.class.name ?? null,
    sectionName: student.section?.name ?? null,
    attendance: {
      total: attendance.length, present, absent, late,
      percent: attendance.length ? round1(((present + late) / attendance.length) * 100) : null,
    },
    overallPercent: exams.length ? round1(exams.reduce((a, e) => a + e.percent, 0) / exams.length) : null,
    subjects: [...bySubject.entries()]
      .map(([subjectName, list]) => ({ subjectName, examsCount: list.length, averagePercent: round1(list.reduce((a, b) => a + b, 0) / list.length) }))
      .sort((a, b) => a.subjectName.localeCompare(b.subjectName)),
    exams,
    assignments: { total: assignmentTotal, submitted: submissions.length, graded: submissions.filter((s) => s.gradePublishedAt).length },
  };
  res.json({ performance: dto });
}
