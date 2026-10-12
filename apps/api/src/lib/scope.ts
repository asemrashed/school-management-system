import type { User } from "@prisma/client";
import { prisma } from "./prisma";
import { AppError } from "./errors";

/**
 * Central data-scope helpers (auth-rbac-matrix.md: "client NEVER receives
 * other users' data"). Role middleware only answers "may this ROLE call this
 * route?" — these helpers answer "may THIS USER touch THIS record?".
 * Every controller that takes a section / student / exam id from the client
 * must go through one of them.
 */

/** Roles with school-wide academic visibility. */
export const ACADEMIC_ADMIN_ROLES = ["super_admin", "admin", "coordinator"] as const;
/** Roles with school-wide finance visibility. */
export const FINANCE_ROLES = ["super_admin", "admin", "accountant"] as const;
/** Roles that may hold a payslip. */
export const STAFF_ROLES = ["super_admin", "admin", "coordinator", "teacher", "accountant", "librarian"] as const;

type Viewer = Pick<User, "id" | "role">;

export const isAcademicAdmin = (u: Viewer) => (ACADEMIC_ADMIN_ROLES as readonly string[]).includes(u.role);
export const isFinanceRole = (u: Viewer) => (FINANCE_ROLES as readonly string[]).includes(u.role);
export const isGuardianRole = (u: Viewer) => u.role === "student" || u.role === "parent";

export async function getTeacherId(userId: string): Promise<string | null> {
  const teacher = await prisma.teacher.findUnique({ where: { userId } });
  return teacher?.id ?? null;
}

/** Sections a teacher is responsible for: teaching a subject there, or
 * delegated as the attendance taker. */
export async function teacherSectionIds(userId: string): Promise<string[]> {
  const teacherId = await getTeacherId(userId);
  if (!teacherId) return [];
  const [assignments, taken] = await Promise.all([
    prisma.classAssignment.findMany({ where: { teacherId } }),
    prisma.section.findMany({ where: { attendanceTakerId: teacherId, deletedAt: null } }),
  ]);
  return Array.from(new Set([...assignments.map((a) => a.sectionId), ...taken.map((s) => s.id)]));
}

/** The (section, subject) pairs a teacher is assigned to teach. */
export async function teacherSubjectPairs(userId: string): Promise<{ sectionId: string; subjectId: string }[]> {
  const teacherId = await getTeacherId(userId);
  if (!teacherId) return [];
  const rows = await prisma.classAssignment.findMany({ where: { teacherId } });
  const seen = new Set<string>();
  return rows
    .map((r) => ({ sectionId: r.sectionId, subjectId: r.subjectId }))
    .filter((p) => !seen.has(p.sectionId + ":" + p.subjectId) && seen.add(p.sectionId + ":" + p.subjectId));
}

/**
 * Prisma `where` fragment limiting a record (anything with sectionId +
 * subjectId) to what this teacher actually teaches. A teacher in the same
 * section who teaches a DIFFERENT subject must not see these rows.
 */
export async function teacherTeachingWhere(userId: string) {
  const pairs = await teacherSubjectPairs(userId);
  return pairs.length ? { OR: pairs } : { id: "__none__" };
}

/** True when the teacher is assigned to teach `subjectId` in `sectionId`. */
export async function teacherTeachesSubjectInSection(userId: string, sectionId: string, subjectId: string) {
  const teacherId = await getTeacherId(userId);
  if (!teacherId) return false;
  const row = await prisma.classAssignment.findFirst({ where: { teacherId, sectionId, subjectId } });
  return Boolean(row);
}

/** The student rows a parent/student may see ([] for any other role). */
export async function ownStudentIds(user: Viewer): Promise<string[]> {
  if (user.role === "student") {
    const self = await prisma.student.findUnique({ where: { userId: user.id } });
    return self && !self.deletedAt ? [self.id] : [];
  }
  if (user.role === "parent") {
    const guardian = await prisma.guardian.findUnique({
      where: { userId: user.id },
      include: { students: true },
    });
    return (guardian?.students ?? []).filter((s) => !s.deletedAt).map((s) => s.id);
  }
  return [];
}

/** Section ids that belong to the viewer's own student(s). */
export async function ownSectionIds(user: Viewer): Promise<string[]> {
  if (user.role === "student") {
    const self = await prisma.student.findUnique({ where: { userId: user.id } });
    return self?.sectionId ? [self.sectionId] : [];
  }
  if (user.role === "parent") {
    const guardian = await prisma.guardian.findUnique({
      where: { userId: user.id },
      include: { students: true },
    });
    return (guardian?.students ?? []).map((s) => s.sectionId).filter((id): id is string => Boolean(id));
  }
  return [];
}

/**
 * Section ids the viewer is restricted to, or `null` for unrestricted
 * (super_admin / admin / coordinator). Teachers -> assigned sections,
 * student/parent -> own sections, everyone else -> none.
 */
export async function visibleSectionIds(user: Viewer): Promise<string[] | null> {
  if (isAcademicAdmin(user)) return null;
  if (user.role === "teacher") return teacherSectionIds(user.id);
  if (isGuardianRole(user)) return ownSectionIds(user);
  return [];
}

/** Throws 403 unless the viewer may access this section's data. */
export async function assertSectionAccess(user: Viewer, sectionId: string) {
  const allowed = await visibleSectionIds(user);
  if (allowed !== null && !allowed.includes(sectionId)) {
    throw AppError.forbidden("You do not have access to this section.");
  }
}

/**
 * Resolves the section filter for a list endpoint. An explicit `sectionId`
 * query param may only NARROW the viewer's scope, never widen it.
 * Returns `undefined` for "no section filter".
 */
export async function resolveSectionFilter(
  user: Viewer,
  requested: string | undefined
): Promise<string | { in: string[] } | undefined> {
  const allowed = await visibleSectionIds(user);
  if (allowed === null) return requested;
  if (requested) {
    if (!allowed.includes(requested)) throw AppError.forbidden("You do not have access to this section.");
    return requested;
  }
  return { in: allowed };
}

/** Throws 403 unless a parent/student owns this student record. Staff pass through. */
export async function assertStudentAccess(user: Viewer, studentId: string) {
  if (!isGuardianRole(user)) return;
  const own = await ownStudentIds(user);
  if (!own.includes(studentId)) throw AppError.forbidden();
}
