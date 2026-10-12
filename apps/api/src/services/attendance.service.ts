import type { SubmitAttendanceInput } from "@packages/shared-types";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { notify } from "./notification.service";

/**
 * Upserts one attendance row per student for the date, then fires
 * `absence_alert` notifications for anyone marked absent (lms-domain.md:
 * "attendance ... absent → notify"). SMS/SMTP resolution is entirely owned
 * by notify() — this service never touches a provider directly.
 */
export async function submitAttendance(input: SubmitAttendanceInput, takenById: string | null) {
  const date = new Date(input.date);

  // Every student must currently belong to THIS section, and appear once —
  // otherwise a caller could overwrite another section's attendance rows.
  const ids = input.entries.map((e) => e.studentId);
  if (new Set(ids).size !== ids.length) {
    throw AppError.badRequest("DUPLICATE_ENTRIES", "Each student may appear only once.");
  }
  const enrolled = await prisma.student.findMany({
    where: { id: { in: ids }, sectionId: input.sectionId, deletedAt: null },
  });
  if (enrolled.length !== ids.length) {
    throw AppError.badRequest("STUDENT_NOT_IN_SECTION", "One or more students do not belong to this section.");
  }

  const results = await prisma.$transaction(
    input.entries.map((entry) =>
      prisma.attendance.upsert({
        where: { studentId_date: { studentId: entry.studentId, date } },
        update: { status: entry.status, sectionId: input.sectionId, takenById },
        create: {
          studentId: entry.studentId,
          sectionId: input.sectionId,
          date,
          status: entry.status,
          takenById,
        },
      })
    )
  );

  const absentStudentIds = input.entries
    .filter((e) => e.status === "absent")
    .map((e) => e.studentId);

  if (absentStudentIds.length > 0) {
    const students = await prisma.student.findMany({
      where: { id: { in: absentStudentIds } },
      include: { user: true, guardian: { include: { user: true } } },
    });

    for (const student of students) {
      if (!student.guardian) continue;
      await notify({
        category: "absence_alert",
        recipientEmail: student.guardian.user.email,
        recipientPhone: student.guardian.phone,
        subject: `${student.user.name} was marked absent today`,
        html: `<p>${student.user.name} was marked absent on ${input.date}. Please contact the school office if this is unexpected.</p>`,
        smsBody: `${student.user.name} was marked absent on ${input.date}.`,
      });
    }
  }

  return results;
}

export async function listAttendance(sectionId: string, date: string) {
  const rows = await prisma.attendance.findMany({
    where: { sectionId, date: new Date(date) },
    include: { student: { include: { user: true } } },
    orderBy: { student: { rollNumber: "asc" } },
  });

  return rows.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    studentName: r.student.user.name,
    rollNumber: r.student.rollNumber,
    sectionId: r.sectionId,
    date: r.date.toISOString().slice(0, 10),
    status: r.status,
  }));
}

/**
 * Who may take a section's daily attendance, in priority order:
 *   1. the admin's explicit override (Section.attendanceTakerId),
 *   2. the teacher whose class assignment is flagged `takesAttendance`
 *      (the "first teacher" chosen when assigning),
 *   3. the section's earliest class assignment (legacy fallback).
 */
export async function resolveAttendanceTaker(sectionId: string) {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: {
      attendanceTaker: { include: { user: true } },
      classAssignments: { include: { teacher: { include: { user: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!section) return null;
  if (section.attendanceTaker) return section.attendanceTaker;
  const flagged = section.classAssignments.find((a) => a.takesAttendance);
  if (flagged) return flagged.teacher;
  return section.classAssignments[0]?.teacher ?? null;
}

/**
 * Sections where this teacher is the one who takes daily attendance
 * (same priority order as resolveAttendanceTaker). Powers the teacher's
 * attendance list so they only see sections they may actually submit.
 */
export async function sectionsTakenBy(teacherId: string, date: Date = todayDate()) {
  const sections = await prisma.section.findMany({
    where: {
      deletedAt: null,
      OR: [{ attendanceTakerId: teacherId }, { classAssignments: { some: { teacherId } } }],
    },
    include: { class: true, classAssignments: { orderBy: { createdAt: "asc" } } },
    orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
  });
  const mine = sections.filter((s) => {
    if (s.attendanceTakerId) return s.attendanceTakerId === teacherId;
    const flagged = s.classAssignments.find((a) => a.takesAttendance) ?? s.classAssignments[0];
    return flagged?.teacherId === teacherId;
  });
  return Promise.all(
    mine.map(async (s) => {
      const [studentCount, rows] = await Promise.all([
        prisma.student.count({ where: { sectionId: s.id, deletedAt: null, user: { isActive: true } } }),
        prisma.attendance.findMany({ where: { sectionId: s.id, date } }),
      ]);
      return {
        id: s.id,
        label: `${s.class.name} — ${s.name}`,
        sectionName: s.name,
        className: s.class.name,
        studentCount,
        takenToday: rows.length > 0,
        presentCount: rows.filter((r) => r.status !== "absent").length,
        absentCount: rows.filter((r) => r.status === "absent").length,
      };
    })
  );
}

/** Today's date at UTC midnight, matching how attendance dates are stored (@db.Date). */
function todayDate(): Date {
  return new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
}
