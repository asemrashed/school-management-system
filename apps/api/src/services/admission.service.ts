import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import type { AdmitStudentInput, AdmitStudentResult, StudentDto } from "@packages/shared-types";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { notify } from "./notification.service";
import { escapeHtml } from "../lib/sanitize";
import { assertRoleCapacity, SERIALIZABLE, mapSerializationError } from "./role-limits.service";

/**
 * Admission = one atomic step that turns an application (or a walk-in) into
 * a working student: login account, guardian link, section + auto roll
 * number + student code, and the first invoices. Either everything is
 * created or nothing is — a half-admitted student is the worst outcome for
 * an office to untangle.
 */

type StudentRow = Prisma.StudentGetPayload<{
  include: { user: true; section: { include: { class: true } }; guardian: { include: { user: true } } };
}>;

export const studentInclude = {
  user: true,
  section: { include: { class: true } },
  guardian: { include: { user: true } },
} satisfies Prisma.StudentInclude;

export function toStudentDto(s: StudentRow): StudentDto {
  return {
    id: s.id,
    userId: s.userId,
    name: s.user.name,
    email: s.user.email,
    studentCode: s.studentCode,
    rollNumber: s.rollNumber,
    sectionId: s.sectionId,
    sectionLabel: s.section ? `${s.section.class.name} — ${s.section.name}` : null,
    guardianId: s.guardianId,
    guardianName: s.guardian?.user.name ?? null,
    guardianPhone: s.guardian?.phone ?? null,
    isActive: s.user.isActive,
    admittedAt: s.admittedAt.toISOString(),
  };
}

/** Next free roll number in a section: max existing numeric roll + 1, zero-padded. */
export async function nextRollNumber(tx: Prisma.TransactionClient, sectionId: string): Promise<string> {
  const rows = await tx.student.findMany({ where: { sectionId, deletedAt: null } });
  const max = rows.reduce((m, r) => Math.max(m, Number.parseInt(r.rollNumber ?? "0", 10) || 0), 0);
  return String(max + 1).padStart(2, "0");
}

/** "2026-0007": year + per-year sequence. Retries on the unique index if two admissions race. */
async function nextStudentCode(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const existing = await tx.student.findMany({ where: { studentCode: { startsWith: `${year}-` } } });
  const max = existing.reduce((m, r) => Math.max(m, Number.parseInt(r.studentCode!.split("-")[1] ?? "0", 10) || 0), 0);
  return `${year}-${String(max + 1).padStart(4, "0")}`;
}

/** Fee structures billed at admission when the office doesn't pick any. */
async function defaultFeeStructureIds(classId: string): Promise<string[]> {
  const year = new Date().getFullYear();
  const rows = await prisma.feeStructure.findMany({
    where: { classId, deletedAt: null, year, kind: { in: ["admission", "monthly"] } },
  });
  return rows.map((r) => r.id);
}

const currentTerm = () => new Date().toISOString().slice(0, 7); // YYYY-MM

export async function admitStudent(input: AdmitStudentInput): Promise<AdmitStudentResult> {
  const section = await prisma.section.findFirst({
    where: { id: input.sectionId, deletedAt: null },
    include: { class: true },
  });
  if (!section) throw AppError.badRequest("SECTION_NOT_FOUND", "That section does not exist.");

  if (await prisma.user.findUnique({ where: { email: input.email } })) {
    throw AppError.conflict("An account with the student's email already exists.");
  }

  let newGuardian: { name: string; email: string; phone: string } | null = null;
  if ("guardianId" in input.guardian) {
    const g = await prisma.guardian.findFirst({ where: { id: input.guardian.guardianId, deletedAt: null } });
    if (!g) throw AppError.badRequest("GUARDIAN_NOT_FOUND", "That guardian does not exist.");
  } else {
    newGuardian = input.guardian;
    if (newGuardian.email === input.email) {
      throw AppError.badRequest("EMAIL_CLASH", "The student and guardian need different email addresses.");
    }
    // A returning parent (second child) is reused by email instead of failing.
    const existingUser = await prisma.user.findUnique({ where: { email: newGuardian.email }, include: { guardianProfile: true } });
    if (existingUser && !existingUser.guardianProfile) {
      throw AppError.conflict("That guardian email belongs to a non-parent account.");
    }
  }

  const feeIds = input.feeStructureIds?.length ? input.feeStructureIds : await defaultFeeStructureIds(section.classId);
  const structures = await prisma.feeStructure.findMany({
    where: { id: { in: feeIds }, deletedAt: null },
  });
  if (structures.length !== new Set(feeIds).size) {
    throw AppError.badRequest("FEE_STRUCTURE_NOT_FOUND", "One of the selected fees does not exist.");
  }
  if (structures.some((f) => f.classId !== section.classId)) {
    throw AppError.badRequest("FEE_CLASS_MISMATCH", "A selected fee belongs to a different class.");
  }

  const dueDate = new Date(input.dueDate ?? new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10));
  // Neither account can log in until its owner sets a password through "Forgot password".
  const unusable = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);

  let guardianCreated = false;
  const result = await prisma
    .$transaction(async (tx) => {
    await assertRoleCapacity("student", tx);
    let guardianId: string;
    if (!newGuardian) {
      guardianId = (input.guardian as { guardianId: string }).guardianId;
    } else {
      const found = await tx.user.findUnique({ where: { email: newGuardian.email }, include: { guardianProfile: true } });
      if (found?.guardianProfile) {
        guardianId = found.guardianProfile.id;
      } else {
        await assertRoleCapacity("parent", tx);
        const gUser = await tx.user.create({
          data: { name: newGuardian.name, email: newGuardian.email, role: "parent", passwordHash: unusable },
        });
        const g = await tx.guardian.create({ data: { userId: gUser.id, phone: newGuardian.phone } });
        guardianId = g.id;
        guardianCreated = true;
      }
    }

    const sUser = await tx.user.create({
      data: { name: input.name, email: input.email, role: "student", passwordHash: unusable },
    });
    const student = await tx.student.create({
      data: {
        userId: sUser.id,
        sectionId: section.id,
        guardianId,
        rollNumber: await nextRollNumber(tx, section.id),
        studentCode: await nextStudentCode(tx),
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        gender: input.gender ?? null,
        address: input.address ?? null,
      },
    });

    const invoices = [];
    for (const f of structures) {
      const term = f.kind === "monthly" ? currentTerm() : f.kind === "admission" ? "Admission" : String(f.year);
      invoices.push(
        await tx.invoice.create({
          data: { studentId: student.id, feeStructureId: f.id, term, amountDue: f.amount, dueDate, status: "unpaid" },
          include: { feeStructure: true },
        })
      );
    }

    if (input.applicationId) {
      const app = await tx.admissionApplication.findUnique({ where: { id: input.applicationId } });
      if (!app) throw AppError.badRequest("APPLICATION_NOT_FOUND", "That application does not exist.");
      if (app.status !== "new") throw AppError.conflict("That application was already reviewed.");
      await tx.admissionApplication.update({ where: { id: app.id }, data: { status: "approved", studentId: student.id } });
    }

    const full = await tx.student.findUnique({ where: { id: student.id }, include: studentInclude });
    return { student: full!, invoices };
  }, SERIALIZABLE)
    .catch(mapSerializationError);

  // Emails go out only after the data is safely committed.
  const guardianEmail = result.student.guardian?.user.email;
  if (guardianEmail) {
    await notify({
      category: "registration_credentials",
      recipientEmail: guardianEmail,
      subject: `${result.student.user.name} has been admitted`,
      html:
        `<p>${escapeHtml(result.student.user.name)} is now enrolled in ${escapeHtml(result.student.section?.class.name ?? "")} — ${escapeHtml(result.student.section?.name ?? "")} ` +
        `(student ID ${result.student.studentCode}).</p>` +
        `<p>Use "Forgot password" on the portal sign-in page with <strong>${escapeHtml(guardianEmail)}</strong> to set your password.</p>`,
    });
  }

  return {
    student: toStudentDto(result.student),
    invoices: result.invoices.map((i) => ({ id: i.id, feeName: i.feeStructure.name, term: i.term, amountDue: i.amountDue })),
    guardianCreated,
  };
}
