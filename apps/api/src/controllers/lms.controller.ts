import type { Request, Response } from "express";
import {
  createResourceSchema,
  createAssignmentSchema,
  submitAssignmentSchema,
  gradeSubmissionSchema,
  type ResourceDto,
  type AssignmentDto,
  type SubmissionDto,
} from "@packages/shared-types";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import {
  getTeacherId,
  isAcademicAdmin,
  isGuardianRole,
  ownStudentIds,
  resolveSectionFilter,
  teacherTeachesSubjectInSection,
} from "../lib/scope";
import { notify } from "../services/notification.service";

/** Teachers may only act on a subject they teach in that section;
 * admin-tier roles are unrestricted. */
async function assertTeachesSection(req: Request, sectionId: string, subjectId: string) {
  if (isAcademicAdmin(req.user!)) return;
  if (req.user!.role !== "teacher") throw AppError.forbidden();
  if (!(await teacherTeachesSubjectInSection(req.user!.id, sectionId, subjectId))) {
    throw AppError.forbidden("You are not assigned to this subject in this section.");
  }
}

/** A teacher may only read/grade submissions of assignments they created. */
async function assertOwnsAssignment(req: Request, a: { sectionId: string; subjectId: string; teacherId: string }) {
  await assertTeachesSection(req, a.sectionId, a.subjectId);
  if (req.user!.role === "teacher") {
    const teacherId = await getTeacherId(req.user!.id);
    if (!teacherId || a.teacherId !== teacherId) throw AppError.forbidden("This assignment belongs to another teacher.");
  }
}

// --- Resources ---

function toResourceDto(row: {
  id: string;
  title: string;
  kind: string;
  url: string;
  classId: string;
  sectionId: string;
  subjectId: string;
  subject: { name: string };
  teacher: { user: { name: string } };
  scheduledAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
}): ResourceDto {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind as ResourceDto["kind"],
    url: row.url,
    classId: row.classId,
    sectionId: row.sectionId,
    subjectId: row.subjectId,
    subjectName: row.subject.name,
    teacherName: row.teacher.user.name,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listResources(req: Request, res: Response) {
  const requested = typeof req.query.sectionId === "string" ? req.query.sectionId : undefined;
  const sectionId = await resolveSectionFilter(req.user!, requested);
  // A teacher sees only the resources THEY uploaded, never a colleague's.
  const ownTeacherId = req.user!.role === "teacher" ? ((await getTeacherId(req.user!.id)) ?? "__none__") : null;

  const rows = await prisma.resource.findMany({
    where: {
      deletedAt: null,
      ...(sectionId ? { sectionId } : {}),
      ...(ownTeacherId ? { teacherId: ownTeacherId } : {}),
      // Rule: no resource visible to parent/student until published (lms-domain.md).
      ...(isGuardianRole(req.user!) ? { publishedAt: { not: null } } : {}),
    },
    include: { subject: true, teacher: { include: { user: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ items: rows.map(toResourceDto) });
}

export async function createResource(req: Request, res: Response) {
  const input = createResourceSchema.parse(req.body);
  const teacher = await prisma.teacher.findUnique({ where: { userId: req.user!.id } });
  if (!teacher) {
    throw AppError.badRequest("NOT_A_TEACHER", "Only a teacher profile can create resources.");
  }
  const section = await prisma.section.findUnique({ where: { id: input.sectionId } });
  if (!section || section.deletedAt) throw AppError.badRequest("SECTION_NOT_FOUND", "That section does not exist.");
  if (section.classId !== input.classId) {
    throw AppError.badRequest("CLASS_SECTION_MISMATCH", "That section does not belong to the chosen class.");
  }
  await assertTeachesSection(req, input.sectionId, input.subjectId);

  const row = await prisma.resource.create({
    data: {
      title: input.title,
      kind: input.kind,
      url: input.url,
      classId: input.classId,
      sectionId: input.sectionId,
      subjectId: input.subjectId,
      teacherId: teacher.id,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
      publishedAt: input.publishNow ? new Date() : undefined,
    },
    include: { subject: true, teacher: { include: { user: true } } },
  });
  res.status(201).json({ resource: toResourceDto(row) });
}

export async function publishResource(req: Request, res: Response) {
  const { id } = req.params;
  const existing = await prisma.resource.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw AppError.notFound("Resource not found.");
  if (req.user!.role === "teacher") {
    const teacherId = await getTeacherId(req.user!.id);
    if (!teacherId || existing.teacherId !== teacherId) {
      throw AppError.forbidden("You can only publish your own resources.");
    }
  }
  const row = await prisma.resource.update({
    where: { id },
    data: { publishedAt: existing.publishedAt ?? new Date() },
    include: { subject: true, teacher: { include: { user: true } } },
  });
  res.json({ resource: toResourceDto(row) });
}

// --- Assignments ---

function toAssignmentDto(row: {
  id: string;
  title: string;
  description: string;
  subjectId: string;
  subject: { name: string };
  sectionId: string;
  section: { name: string };
  teacher: { user: { name: string } };
  dueAt: Date;
  createdAt: Date;
}): AssignmentDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    subjectId: row.subjectId,
    subjectName: row.subject.name,
    sectionId: row.sectionId,
    sectionName: row.section.name,
    teacherName: row.teacher.user.name,
    dueAt: row.dueAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listAssignments(req: Request, res: Response) {
  const requested = typeof req.query.sectionId === "string" ? req.query.sectionId : undefined;
  const sectionId = await resolveSectionFilter(req.user!, requested);

  // A teacher sees only the assignments THEY created.
  const ownTeacherId = req.user!.role === "teacher" ? ((await getTeacherId(req.user!.id)) ?? "__none__") : null;

  const rows = await prisma.assignment.findMany({
    where: { deletedAt: null, ...(sectionId ? { sectionId } : {}), ...(ownTeacherId ? { teacherId: ownTeacherId } : {}) },
    include: { subject: true, section: true, teacher: { include: { user: true } } },
    orderBy: { dueAt: "asc" },
  });
  res.json({ items: rows.map(toAssignmentDto) });
}

export async function createAssignment(req: Request, res: Response) {
  const input = createAssignmentSchema.parse(req.body);
  const teacher = await prisma.teacher.findUnique({ where: { userId: req.user!.id } });
  if (!teacher) throw AppError.badRequest("NOT_A_TEACHER", "Only a teacher profile can create assignments.");
  const section = await prisma.section.findUnique({ where: { id: input.sectionId } });
  if (!section || section.deletedAt) throw AppError.badRequest("SECTION_NOT_FOUND", "That section does not exist.");
  await assertTeachesSection(req, input.sectionId, input.subjectId);

  const row = await prisma.assignment.create({
    data: { ...input, dueAt: new Date(input.dueAt), teacherId: teacher.id },
    include: { subject: true, section: true, teacher: { include: { user: true } } },
  });

  // Notify every guardian of a student in this section (messaging-domain.md:
  // assignment_posted is SMTP-only by design, no SMS variant).
  const students = await prisma.student.findMany({
    where: { sectionId: input.sectionId, deletedAt: null },
    include: { guardian: { include: { user: true } } },
  });
  for (const student of students) {
    if (!student.guardian) continue;
    await notify({
      category: "assignment_posted",
      recipientEmail: student.guardian.user.email,
      subject: `New assignment: ${row.title}`,
      html: `<p>A new assignment "${row.title}" in ${row.subject.name} is due ${row.dueAt.toDateString()}.</p>`,
    });
  }

  res.status(201).json({ assignment: toAssignmentDto(row) });
}

// --- Submissions ---

function toSubmissionDto(row: {
  id: string;
  assignmentId: string;
  studentId: string;
  student: { user: { name: string } };
  body: string | null;
  fileUrl: string | null;
  grade: number | null;
  feedback: string | null;
  gradePublishedAt: Date | null;
  submittedAt: Date;
}): SubmissionDto {
  const published = Boolean(row.gradePublishedAt);
  return {
    id: row.id,
    assignmentId: row.assignmentId,
    studentId: row.studentId,
    studentName: row.student.user.name,
    body: row.body,
    fileUrl: row.fileUrl,
    submittedAt: row.submittedAt.toISOString(),
    grade: published ? row.grade : null,
    feedback: published ? row.feedback : null,
    gradePublishedAt: row.gradePublishedAt?.toISOString() ?? null,
  };
}

export async function listSubmissions(req: Request, res: Response) {
  const { assignmentId } = req.params;
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment || assignment.deletedAt) throw AppError.notFound("Assignment not found.");

  // Student / parent: only their own child's submission(s).
  if (isGuardianRole(req.user!)) {
    const studentIds = await ownStudentIds(req.user!);
    const rows = await prisma.submission.findMany({
      where: { assignmentId, studentId: { in: studentIds } },
      include: { student: { include: { user: true } } },
    });
    return res.json({ items: rows.map(toSubmissionDto) });
  }

  await assertOwnsAssignment(req, assignment);
  const rows = await prisma.submission.findMany({
    where: { assignmentId },
    include: { student: { include: { user: true } } },
    orderBy: { submittedAt: "desc" },
  });
  res.json({ items: rows.map(toSubmissionDto) });
}

export async function submitAssignment(req: Request, res: Response) {
  const { assignmentId } = req.params;
  const input = submitAssignmentSchema.parse(req.body);
  const self = await prisma.student.findUnique({ where: { userId: req.user!.id } });
  if (!self) throw AppError.forbidden("Only students can submit assignments.");

  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw AppError.notFound("Assignment not found.");
  if (assignment.sectionId !== self.sectionId) {
    throw AppError.forbidden("This assignment isn't for your section.");
  }

  const row = await prisma.submission.upsert({
    where: { assignmentId_studentId: { assignmentId, studentId: self.id } },
    update: { body: input.body, fileUrl: input.fileUrl, submittedAt: new Date() },
    create: { assignmentId, studentId: self.id, body: input.body, fileUrl: input.fileUrl },
    include: { student: { include: { user: true } } },
  });
  res.status(201).json({ submission: toSubmissionDto(row) });
}

export async function gradeSubmission(req: Request, res: Response) {
  const { id } = req.params;
  const input = gradeSubmissionSchema.parse(req.body);

  const existing = await prisma.submission.findUnique({
    where: { id },
    include: { assignment: true },
  });
  if (!existing) throw AppError.notFound("Submission not found.");
  await assertOwnsAssignment(req, existing.assignment);

  // NOTE: publishing a grade doesn't send a notification yet — there's no
  // dedicated messaging-domain.md category for it (assignment_posted covers
  // the assignment being created, not graded). Add one there first if this
  // needs to notify guardians in a later phase.
  const row = await prisma.submission.update({
    where: { id },
    data: {
      grade: input.grade,
      feedback: input.feedback,
      gradePublishedAt: input.publish ? new Date() : undefined,
    },
    include: { student: { include: { user: true } } },
  });

  res.json({ submission: toSubmissionDto(row) });
}
