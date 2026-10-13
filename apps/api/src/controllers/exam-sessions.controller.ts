import type { Request, Response } from "express";
import {
  createExamSessionSchema,
  resultSheetQuerySchema,
  type ExamSessionDto,
  type ExamSessionExamRow,
  type ResultRow,
  type ResultSheetDto,
  type MyResultDto,
} from "@packages/shared-types";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { isAcademicAdmin, isGuardianRole, ownStudentIds, teacherTeachingWhere } from "../lib/scope";
import { gradeFor, round2, summarise } from "../lib/grading";
import { examStatus } from "./exams.controller";

const isTeacher = (req: Request) => req.user!.role === "teacher";

function progressOf(exams: { approvedAt: Date | null; marksSubmittedAt: Date | null }[]) {
  return {
    total: exams.length,
    submitted: exams.filter((e) => e.marksSubmittedAt || e.approvedAt).length,
    approved: exams.filter((e) => e.approvedAt).length,
  };
}

/** Admin tier: creates one session for a class; fans out to section x subject exams. */
export async function createSession(req: Request, res: Response) {
  const input = createExamSessionSchema.parse(req.body);
  const cls = await prisma.class.findFirst({ where: { id: input.classId, deletedAt: null } });
  if (!cls) throw AppError.badRequest("CLASS_NOT_FOUND", "That class does not exist.");

  const [sections, subjects] = await Promise.all([
    prisma.section.findMany({ where: { classId: cls.id, deletedAt: null } }),
    prisma.subject.findMany({
      where: { id: { in: input.subjects.map((s) => s.subjectId) }, classId: cls.id, deletedAt: null },
    }),
  ]);
  if (subjects.length !== new Set(input.subjects.map((s) => s.subjectId)).size) {
    throw AppError.badRequest("SUBJECT_CLASS_MISMATCH", "One or more subjects do not belong to this class.");
  }
  const chosen = input.sectionIds ? sections.filter((s) => input.sectionIds!.includes(s.id)) : sections;
  if (input.sectionIds && chosen.length !== new Set(input.sectionIds).size) {
    throw AppError.badRequest("SECTION_CLASS_MISMATCH", "One or more sections do not belong to this class.");
  }
  if (chosen.length === 0) throw AppError.badRequest("NO_SECTIONS", "This class has no sections yet.");

  const dup = await prisma.examSession.findFirst({
    where: { classId: cls.id, name: input.name, term: input.term, deletedAt: null },
  });
  if (dup) throw AppError.conflict("An exam with this name and term already exists for this class.");

  const session = await prisma.examSession.create({
    data: { name: input.name, term: input.term, classId: cls.id, createdById: req.user!.id },
  });
  for (const sub of input.subjects) {
    for (const section of chosen) {
      await prisma.exam.create({
        data: {
          name: input.name,
          type: input.type,
          subjectId: sub.subjectId,
          sectionId: section.id,
          examDate: new Date(input.examDate),
          maxMarks: sub.maxMarks,
          sessionId: session.id,
        },
      });
    }
  }
  res.status(201).json({ session: await sessionDto(session.id, req) });
}

async function sessionDto(id: string, req: Request): Promise<ExamSessionDto> {
  const s = await prisma.examSession.findUnique({ where: { id }, include: { class: true } });
  if (!s) throw AppError.notFound("Exam not found.");
  const scope = isTeacher(req) ? await teacherTeachingWhere(req.user!.id) : {};
  const exams = await prisma.exam.findMany({ where: { sessionId: id, deletedAt: null, ...scope } });
  return {
    id: s.id,
    name: s.name,
    term: s.term as ExamSessionDto["term"],
    classId: s.classId,
    className: s.class.name,
    publishedAt: s.publishedAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
    progress: progressOf(exams),
  };
}

/** Admin tier: every session. Teacher: only sessions containing a subject they teach. */
export async function listSessions(req: Request, res: Response) {
  const classId = typeof req.query.classId === "string" ? req.query.classId : undefined;
  const sessions = await prisma.examSession.findMany({
    where: { deletedAt: null, ...(classId ? { classId } : {}) },
    orderBy: { createdAt: "desc" },
  });
  const items: ExamSessionDto[] = [];
  for (const s of sessions) {
    const dto = await sessionDto(s.id, req);
    if (isTeacher(req) && dto.progress.total === 0) continue;
    items.push(dto);
  }
  res.json({ items });
}

/** Admin tier: who has entered / submitted / been approved, exam by exam. */
export async function sessionProgress(req: Request, res: Response) {
  const { id } = req.params;
  const session = await prisma.examSession.findUnique({ where: { id } });
  if (!session || session.deletedAt) throw AppError.notFound("Exam not found.");

  const exams = await prisma.exam.findMany({
    where: { sessionId: id, deletedAt: null },
    include: { subject: true, section: true },
    orderBy: { examDate: "asc" },
  });
  const assignments = await prisma.classAssignment.findMany({
    where: { sectionId: { in: exams.map((e) => e.sectionId) } },
    include: { teacher: { include: { user: true } } },
  });
  const rows: ExamSessionExamRow[] = [];
  for (const e of exams) {
    const [studentCount, marksEntered] = await Promise.all([
      prisma.student.count({ where: { sectionId: e.sectionId, deletedAt: null } }),
      prisma.mark.count({ where: { examId: e.id } }),
    ]);
    const owner = assignments.find((a) => a.sectionId === e.sectionId && a.subjectId === e.subjectId);
    rows.push({
      examId: e.id,
      subjectName: e.subject.name,
      sectionId: e.sectionId,
      sectionName: e.section.name,
      teacherName: owner?.teacher.user.name ?? null,
      maxMarks: e.maxMarks,
      examDate: e.examDate.toISOString().slice(0, 10),
      status: examStatus(e),
      marksEntered,
      studentCount,
      returnNote: e.returnNote,
    });
  }
  rows.sort((a, b) => a.sectionName.localeCompare(b.sectionName) || a.subjectName.localeCompare(b.subjectName));
  res.json({ items: rows });
}

/** Admin tier, only while unpublished: removes the session and its exams. */
export async function deleteSession(req: Request, res: Response) {
  const { id } = req.params;
  const session = await prisma.examSession.findUnique({ where: { id } });
  if (!session || session.deletedAt) throw AppError.notFound("Exam not found.");
  if (session.publishedAt) throw AppError.conflict("Published results cannot be deleted.");
  const now = new Date();
  await prisma.exam.updateMany({ where: { sessionId: id }, data: { deletedAt: now } });
  await prisma.examSession.update({ where: { id }, data: { deletedAt: now } });
  res.status(204).send();
}

const csvCell = (v: unknown) => {
  let t = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`; // neutralise spreadsheet-formula injection
  return `"${t.replace(/"/g, '""')}"`;
};

/**
 * Spreadsheet-style result sheet: one row per student, one column per subject.
 *  - admin tier: every student/subject, any approval state (cells show status), with GPA/rank-ready totals.
 *  - teacher: ONLY the subjects they teach, only their students; no overall grade (it would be misleading).
 * Filtering, sorting and pagination happen server-side.
 */
export async function resultSheet(req: Request, res: Response) {
  const { id } = req.params;
  const q = resultSheetQuerySchema.parse(req.query);
  const session = await prisma.examSession.findUnique({ where: { id }, include: { class: true } });
  if (!session || session.deletedAt) throw AppError.notFound("Exam not found.");

  const teacher = isTeacher(req);
  const scope = teacher ? await teacherTeachingWhere(req.user!.id) : {};
  const exams = await prisma.exam.findMany({
    where: { sessionId: id, deletedAt: null, ...scope, ...(q.sectionId ? { sectionId: q.sectionId } : {}) },
    include: { subject: true, section: true, marks: true },
  });

  const subjectMap = new Map<string, { subjectId: string; name: string; maxMarks: number }>();
  for (const e of exams) if (!subjectMap.has(e.subjectId)) subjectMap.set(e.subjectId, { subjectId: e.subjectId, name: e.subject.name, maxMarks: e.maxMarks });
  const subjects = [...subjectMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  const sectionIds = [...new Set(exams.map((e) => e.sectionId))];
  const students = await prisma.student.findMany({
    where: { sectionId: { in: sectionIds }, deletedAt: null },
    include: { user: true, section: true },
  });

  const complete = !teacher;
  // Non-admin viewers must never see marks that are not yet approved for OTHER subjects; a teacher only gets their own.
  let rows: ResultRow[] = students.map((st) => {
    const cells: ResultRow["cells"] = {};
    const scored: { obtained: number; maxMarks: number }[] = [];
    for (const sub of subjects) {
      const exam = exams.find((e) => e.sectionId === st.sectionId && e.subjectId === sub.subjectId);
      const mark = exam?.marks.find((m) => m.studentId === st.id);
      cells[sub.subjectId] = { obtained: mark ? mark.marksObtained : null, status: exam ? examStatus(exam) : null };
      if (mark && exam) scored.push({ obtained: mark.marksObtained, maxMarks: exam.maxMarks });
    }
    const sum = summarise(scored);
    const allIn = scored.length === subjects.length && subjects.length > 0;
    return {
      studentId: st.id,
      name: st.user.name,
      rollNumber: st.rollNumber,
      sectionName: st.section?.name ?? "",
      cells,
      total: sum.total,
      maxTotal: sum.maxTotal,
      percent: scored.length ? sum.percent : null,
      grade: complete && allIn ? sum.grade : null,
      gpa: complete && allIn ? sum.gpa : null,
      passed: complete && allIn ? sum.passed : null,
    };
  });

  if (q.q) {
    const needle = q.q.toLowerCase();
    rows = rows.filter((r) => r.name.toLowerCase().includes(needle) || (r.rollNumber ?? "").toLowerCase().includes(needle));
  }
  if (q.result !== "all") {
    if (!complete) throw AppError.badRequest("FILTER_NOT_AVAILABLE", "Pass/fail filtering needs the full result sheet.");
    rows = rows.filter((r) => (q.result === "pass" ? r.passed === true : r.passed === false));
  }

  const dir = q.dir === "desc" ? -1 : 1;
  const rollKey = (r: ResultRow) => Number(r.rollNumber) || 0;
  rows.sort((a, b) => {
    let c = 0;
    if (q.sort === "name") c = a.name.localeCompare(b.name);
    else if (q.sort === "total") c = a.total - b.total;
    else if (q.sort === "percent") c = (a.percent ?? -1) - (b.percent ?? -1);
    else c = a.sectionName.localeCompare(b.sectionName) || rollKey(a) - rollKey(b) || a.name.localeCompare(b.name);
    return (c || a.name.localeCompare(b.name)) * dir;
  });

  const head = { id: session.id, name: session.name, term: session.term as ResultSheetDto["session"]["term"], className: session.class.name, publishedAt: session.publishedAt?.toISOString() ?? null };

  if (q.format === "csv") {
    const header = ["Section", "Roll", "Student", ...subjects.map((s) => `${s.name} (/${s.maxMarks})`), "Total", "Percent", ...(complete ? ["Grade", "GPA"] : [])];
    const lines = [header.map(csvCell).join(",")];
    for (const r of rows) {
      lines.push(
        [r.sectionName, r.rollNumber, r.name, ...subjects.map((s) => r.cells[s.subjectId]?.obtained ?? ""), r.total, r.percent ?? "", ...(complete ? [r.grade ?? "", r.gpa ?? ""] : [])]
          .map(csvCell)
          .join(",")
      );
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="results-${session.id}.csv"`);
    return res.send("﻿" + lines.join("\r\n"));
  }

  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / q.pageSize));
  const page = Math.min(q.page, totalPages);
  const dto: ResultSheetDto = {
    session: head,
    subjects,
    rows: rows.slice((page - 1) * q.pageSize, page * q.pageSize),
    page,
    pageSize: q.pageSize,
    totalRows,
    totalPages,
    complete,
  };
  res.json({ sheet: dto });
}

/** Student / parent: published report cards for their own child/children only. */
export async function myResults(req: Request, res: Response) {
  if (!isGuardianRole(req.user!)) throw AppError.forbidden();
  const studentIds = await ownStudentIds(req.user!);
  const students = await prisma.student.findMany({ where: { id: { in: studentIds } }, include: { user: true } });

  const items: MyResultDto[] = [];
  for (const st of students) {
    const marks = await prisma.mark.findMany({
      where: { studentId: st.id, exam: { publishedAt: { not: null }, deletedAt: null, sessionId: { not: null } } },
      include: { exam: { include: { subject: true, session: true } } },
    });
    const bySession = new Map<string, typeof marks>();
    for (const m of marks) bySession.set(m.exam.sessionId!, [...(bySession.get(m.exam.sessionId!) ?? []), m]);

    const sessions = [...bySession.entries()].map(([sessionId, list]) => {
      const sum = summarise(list.map((m) => ({ obtained: m.marksObtained, maxMarks: m.exam.maxMarks })));
      const session = list[0].exam.session!;
      return {
        sessionId,
        sessionName: session.name,
        term: session.term as MyResultDto["sessions"][number]["term"],
        publishedAt: (session.publishedAt ?? new Date()).toISOString(),
        subjects: list
          .map((m) => ({
            subjectName: m.exam.subject.name,
            obtained: m.marksObtained,
            maxMarks: m.exam.maxMarks,
            grade: gradeFor((m.marksObtained / m.exam.maxMarks) * 100).grade,
          }))
          .sort((a, b) => a.subjectName.localeCompare(b.subjectName)),
        total: sum.total,
        maxTotal: sum.maxTotal,
        percent: round2(sum.percent),
        grade: sum.grade,
        gpa: sum.gpa,
        passed: sum.passed,
      };
    });
    sessions.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    items.push({ studentId: st.id, studentName: st.user.name, sessions });
  }
  res.json({ items });
}
