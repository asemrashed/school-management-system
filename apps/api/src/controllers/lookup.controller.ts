import type { Request, Response } from "express";
import { lookupKindSchema, lookupQuerySchema, type LookupItem, type LookupKind } from "@packages/shared-types";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { isAcademicAdmin, visibleSectionIds, getTeacherId } from "../lib/scope";

/**
 * Backs every searchable dropdown in the UI, so nobody ever types an id.
 * One endpoint per "kind", each returning { value, label, hint? } rows
 * filtered by `?q=` (case-insensitive, capped by `limit`).
 *
 * Access is deliberately narrower than the full CRUD: teachers get only the
 * classes / sections / subjects / students they actually teach, accountants
 * get students and class structure (for fees), and student/parent get
 * nothing. The same scope helpers as the rest of the API are used, so a
 * dropdown can't become a side door around them.
 */

type Viewer = NonNullable<Request["user"]>;
const contains = (q?: string) => (q ? { contains: q, mode: "insensitive" as const } : undefined);

const ADMIN_ONLY: LookupKind[] = ["teachers", "rooms", "buildings", "shifts", "periods", "guardians"];

function assertMayLookup(user: Viewer, kind: LookupKind) {
  if (isAcademicAdmin(user)) return;
  if (ADMIN_ONLY.includes(kind)) throw AppError.forbidden();
  // Finance and library desks get exactly the pickers they need, nothing broader
  // (these lists expose names + emails, so teachers must not reach them).
  if (user.role === "accountant") {
    if (["students", "classes", "sections", "feeStructures", "staff"].includes(kind)) return;
    throw AppError.forbidden();
  }
  if (user.role === "librarian") {
    if (kind === "users") return;
    throw AppError.forbidden();
  }
  if (user.role === "teacher") {
    if (["feeStructures", "staff", "users"].includes(kind)) throw AppError.forbidden();
    return;
  }
  throw AppError.forbidden();
}

export async function lookup(req: Request, res: Response) {
  const kind = lookupKindSchema.parse(req.params.kind);
  const { q, classId, sectionId, shiftId, limit } = lookupQuerySchema.parse(req.query);
  const user = req.user!;
  assertMayLookup(user, kind);

  // Sections this viewer may see; null = unrestricted (admin-tier, accountant).
  const scope = user.role === "accountant" ? null : await visibleSectionIds(user);
  const take = limit;
  let items: LookupItem[] = [];

  switch (kind) {
    case "teachers": {
      const rows = await prisma.teacher.findMany({
        where: { deletedAt: null, user: { deletedAt: null, isActive: true, ...(q ? { name: contains(q) } : {}) } },
        include: { user: true },
        orderBy: { user: { name: "asc" } },
        take,
      });
      items = rows.map((t) => ({ value: t.id, label: t.user.name, hint: t.user.email }));
      break;
    }
    case "students": {
      const rows = await prisma.student.findMany({
        where: {
          deletedAt: null,
          user: { deletedAt: null, ...(q ? { name: contains(q) } : {}) },
          ...(sectionId ? { sectionId } : {}),
          ...(classId ? { section: { classId } } : {}),
          ...(scope ? { sectionId: sectionId ? sectionId : { in: scope } } : {}),
        },
        include: { user: true, section: { include: { class: true } } },
        orderBy: { user: { name: "asc" } },
        take,
      });
      // A scoped viewer asking for a section outside their scope gets nothing.
      const allowed = rows.filter((s) => !scope || (s.sectionId && scope.includes(s.sectionId)));
      items = allowed.map((s) => ({
        value: s.id,
        label: s.user.name,
        hint: s.section ? `${s.section.class.name} ${s.section.name}${s.rollNumber ? ` · Roll ${s.rollNumber}` : ""}` : "No section",
      }));
      break;
    }
    case "classes": {
      const rows = await prisma.class.findMany({
        where: {
          deletedAt: null,
          ...(q ? { name: contains(q) } : {}),
          ...(scope ? { sections: { some: { id: { in: scope }, deletedAt: null } } } : {}),
        },
        include: { shift: true },
        orderBy: { name: "asc" },
        take,
      });
      items = rows.map((c) => ({ value: c.id, label: c.name, hint: c.shift.name }));
      break;
    }
    case "sections": {
      const rows = await prisma.section.findMany({
        where: {
          deletedAt: null,
          ...(classId ? { classId } : {}),
          ...(q ? { OR: [{ name: contains(q) }, { class: { name: contains(q) } }] } : {}),
          ...(scope ? { id: { in: scope } } : {}),
        },
        include: { class: true },
        orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
        take,
      });
      items = rows.map((s) => ({ value: s.id, label: `${s.class.name} — ${s.name}`, hint: undefined }));
      break;
    }
    case "subjects": {
      let subjectIds: string[] | undefined;
      if (user.role === "teacher") {
        // Only the subjects this teacher is assigned to teach.
        const teacherId = (await getTeacherId(user.id)) ?? "__none__";
        const mine = await prisma.classAssignment.findMany({
          where: { teacherId, ...(sectionId ? { sectionId } : {}) },
        });
        subjectIds = mine.map((a) => a.subjectId);
      }
      const rows = await prisma.subject.findMany({
        where: {
          deletedAt: null,
          ...(classId ? { classId } : {}),
          ...(q ? { name: contains(q) } : {}),
          ...(subjectIds ? { id: { in: subjectIds } } : {}),
        },
        include: { class: true },
        orderBy: { name: "asc" },
        take,
      });
      items = rows.map((s) => ({ value: s.id, label: s.name, hint: s.class.name }));
      break;
    }
    case "rooms": {
      const rows = await prisma.room.findMany({
        where: { deletedAt: null, ...(q ? { name: contains(q) } : {}) },
        include: { building: true },
        orderBy: { name: "asc" },
        take,
      });
      items = rows.map((r) => ({ value: r.id, label: r.name, hint: r.building?.name }));
      break;
    }
    case "buildings": {
      const rows = await prisma.building.findMany({
        where: { deletedAt: null, ...(q ? { name: contains(q) } : {}) },
        orderBy: { name: "asc" },
        take,
      });
      items = rows.map((b) => ({ value: b.id, label: b.name }));
      break;
    }
    case "shifts": {
      const rows = await prisma.shift.findMany({
        where: { deletedAt: null, ...(q ? { name: contains(q) } : {}) },
        orderBy: { name: "asc" },
        take,
      });
      items = rows.map((s) => ({ value: s.id, label: s.name }));
      break;
    }
    case "periods": {
      const rows = await prisma.period.findMany({
        where: { ...(shiftId ? { shiftId } : {}), ...(q ? { name: contains(q) } : {}) },
        orderBy: [{ sortOrder: "asc" }],
        take,
      });
      items = rows.map((p) => ({ value: p.id, label: p.name, hint: `${p.startTime}–${p.endTime}${p.isBreak ? " (break)" : ""}` }));
      break;
    }
    case "guardians": {
      const rows = await prisma.guardian.findMany({
        where: { deletedAt: null, user: { deletedAt: null, ...(q ? { name: contains(q) } : {}) } },
        include: { user: true },
        orderBy: { user: { name: "asc" } },
        take,
      });
      items = rows.map((g) => ({ value: g.id, label: g.user.name, hint: g.phone ?? g.user.email }));
      break;
    }
    case "feeStructures": {
      const rows = await prisma.feeStructure.findMany({
        where: { deletedAt: null, ...(classId ? { classId } : {}), ...(q ? { name: contains(q) } : {}) },
        include: { class: true },
        orderBy: [{ year: "desc" }, { name: "asc" }],
        take,
      });
      items = rows.map((f) => ({ value: f.id, label: f.name, hint: `${f.class.name} · ${f.kind} · ৳${(f.amount / 100).toFixed(2)}` }));
      break;
    }
    case "staff":
    case "users": {
      const staffRoles = ["admin", "coordinator", "teacher", "accountant", "librarian"] as const;
      const rows = await prisma.user.findMany({
        where: {
          deletedAt: null,
          isActive: true,
          ...(kind === "staff" ? { role: { in: [...staffRoles] } } : {}),
          ...(q ? { name: contains(q) } : {}),
        },
        orderBy: { name: "asc" },
        take,
      });
      items = rows.map((u) => ({ value: u.id, label: u.name, hint: `${u.role.replace("_", " ")} · ${u.email}` }));
      break;
    }
  }

  res.json({ items });
}
