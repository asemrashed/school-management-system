import type { Request, Response } from "express";
import {
  siteKeySchema,
  SITE_SCHEMAS,
  contactFormSchema,
  admissionFormSchema,
  rejectApplicationSchema,
  updateWebsiteTeacherSchema,
  createGalleryImageSchema,
  updateGalleryImageSchema,
  type WebsiteTeacher,
  type GalleryImageDto,
  type AdmissionApplicationDto,
  type ContactMessageDto,
} from "@packages/shared-types";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { escapeHtml } from "../lib/sanitize";
import { notify } from "../services/notification.service";
import { readPublicSite, readSetting, writeSetting } from "../services/site.service";

// --- Public ------------------------------------------------------------------

export async function getPublicSite(_req: Request, res: Response) {
  res.json(await readPublicSite());
}

export async function submitContact(req: Request, res: Response) {
  const input = contactFormSchema.parse(req.body);
  // Honeypot: bots fill the hidden field. Pretend success so they don't retry.
  if (input.website) {
    res.status(201).json({ ok: true });
    return;
  }
  await prisma.contactMessage.create({
    data: { name: input.name, email: input.email, phone: input.phone ?? null, message: input.message },
  });
  res.status(201).json({ ok: true });
}

export async function submitAdmission(req: Request, res: Response) {
  const input = admissionFormSchema.parse(req.body);
  if (input.website) {
    res.status(201).json({ ok: true });
    return;
  }
  const settings = await readSetting("admission");
  if (!settings.open) throw AppError.badRequest("ADMISSION_CLOSED", settings.closedMessage);
  const cls = await prisma.class.findFirst({ where: { id: input.appliedClassId, deletedAt: null } });
  if (!cls) throw AppError.badRequest("CLASS_NOT_FOUND", "Please choose a class from the list.");

  await prisma.admissionApplication.create({
    data: {
      studentName: input.studentName,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
      gender: input.gender ?? null,
      appliedClassId: cls.id,
      previousSchool: input.previousSchool ?? null,
      guardianName: input.guardianName,
      guardianPhone: input.guardianPhone,
      guardianEmail: input.guardianEmail,
      address: input.address ?? null,
      message: input.message ?? null,
    },
  });

  // Acknowledge by email (public text is escaped before it goes into HTML).
  await notify({
    category: "general_notice",
    recipientEmail: input.guardianEmail,
    subject: "We received your admission application",
    html: `<p>Dear ${escapeHtml(input.guardianName)},</p><p>Thank you for applying for ${escapeHtml(input.studentName)} (${escapeHtml(cls.name)}). Our office will contact you soon.</p>`,
  }).catch(() => undefined); // an email hiccup must not lose a saved application
  res.status(201).json({ ok: true });
}

export async function listPublicGallery(_req: Request, res: Response) {
  const rows = await prisma.galleryImage.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
  res.json({ items: rows.map((g) => ({ id: g.id, url: g.url, caption: g.caption, album: g.album })) });
}

// --- Admin: settings -----------------------------------------------------------

export async function getAllSettings(_req: Request, res: Response) {
  const [general, home, admission] = await Promise.all([readSetting("general"), readSetting("home"), readSetting("admission")]);
  res.json({ general, home, admission });
}

export async function putSetting(req: Request, res: Response) {
  const key = siteKeySchema.parse(req.params.key);
  const value = SITE_SCHEMAS[key].parse(req.body);
  await writeSetting(key, value);
  res.json({ [key]: await readSetting(key) });
}

// --- Admin: teachers on the website ---------------------------------------------

const toWebsiteTeacher = (t: {
  id: string; designation: string | null; subject: string | null; bio: string | null; photoUrl: string | null;
  showOnWebsite: boolean; websiteOrder: number; user: { name: string };
}): WebsiteTeacher => ({
  id: t.id,
  name: t.user.name,
  designation: t.designation ?? t.subject,
  bio: t.bio,
  photoUrl: t.photoUrl,
  showOnWebsite: t.showOnWebsite,
  websiteOrder: t.websiteOrder,
});

export async function listWebsiteTeachers(_req: Request, res: Response) {
  const rows = await prisma.teacher.findMany({
    where: { deletedAt: null },
    include: { user: true },
    orderBy: [{ websiteOrder: "asc" }],
  });
  res.json({ items: rows.map(toWebsiteTeacher) });
}

export async function updateWebsiteTeacher(req: Request, res: Response) {
  const input = updateWebsiteTeacherSchema.parse(req.body);
  const existing = await prisma.teacher.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!existing) throw AppError.notFound("Teacher not found.");
  const row = await prisma.teacher.update({ where: { id: existing.id }, data: input, include: { user: true } });
  res.json({ teacher: toWebsiteTeacher(row) });
}

// --- Admin: gallery ------------------------------------------------------------------

const toGallery = (g: { id: string; url: string; caption: string | null; album: string | null; sortOrder: number }): GalleryImageDto => ({
  id: g.id, url: g.url, caption: g.caption, album: g.album, sortOrder: g.sortOrder,
});

export async function listGallery(_req: Request, res: Response) {
  const rows = await prisma.galleryImage.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
  res.json({ items: rows.map(toGallery) });
}
export async function createGalleryImage(req: Request, res: Response) {
  const input = createGalleryImageSchema.parse(req.body);
  const row = await prisma.galleryImage.create({
    data: { url: input.url, caption: input.caption ?? null, album: input.album ?? null, sortOrder: input.sortOrder ?? 0 },
  });
  res.status(201).json({ image: toGallery(row) });
}
export async function updateGalleryImage(req: Request, res: Response) {
  const input = updateGalleryImageSchema.parse(req.body);
  const existing = await prisma.galleryImage.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!existing) throw AppError.notFound("Image not found.");
  const row = await prisma.galleryImage.update({ where: { id: existing.id }, data: input });
  res.json({ image: toGallery(row) });
}
export async function deleteGalleryImage(req: Request, res: Response) {
  const existing = await prisma.galleryImage.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!existing) throw AppError.notFound("Image not found.");
  await prisma.galleryImage.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
  res.status(204).send();
}

// --- Admin: inbox (contact messages + admission applications) --------------------------

export async function listContactMessages(_req: Request, res: Response) {
  const rows = await prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const items: ContactMessageDto[] = rows.map((m) => ({
    id: m.id, name: m.name, email: m.email, phone: m.phone, message: m.message, isRead: m.isRead, createdAt: m.createdAt.toISOString(),
  }));
  res.json({ items });
}
export async function markContactRead(req: Request, res: Response) {
  const existing = await prisma.contactMessage.findUnique({ where: { id: req.params.id } });
  if (!existing) throw AppError.notFound("Message not found.");
  await prisma.contactMessage.update({ where: { id: existing.id }, data: { isRead: true } });
  res.status(204).send();
}

const toApplication = (a: {
  id: string; studentName: string; dateOfBirth: Date | null; gender: string | null; appliedClassId: string | null;
  appliedClass: { name: string } | null; previousSchool: string | null; guardianName: string; guardianPhone: string;
  guardianEmail: string; address: string | null; message: string | null; status: string; createdAt: Date;
}): AdmissionApplicationDto => ({
  id: a.id,
  studentName: a.studentName,
  dateOfBirth: a.dateOfBirth?.toISOString().slice(0, 10) ?? null,
  gender: a.gender,
  appliedClassId: a.appliedClassId,
  appliedClassName: a.appliedClass?.name ?? null,
  previousSchool: a.previousSchool,
  guardianName: a.guardianName,
  guardianPhone: a.guardianPhone,
  guardianEmail: a.guardianEmail,
  address: a.address,
  message: a.message,
  status: a.status as AdmissionApplicationDto["status"],
  createdAt: a.createdAt.toISOString(),
});

export async function listApplications(req: Request, res: Response) {
  const status = typeof req.query.status === "string" && ["new", "approved", "rejected"].includes(req.query.status) ? req.query.status : undefined;
  const rows = await prisma.admissionApplication.findMany({
    where: status ? { status: status as "new" | "approved" | "rejected" } : {},
    include: { appliedClass: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json({ items: rows.map(toApplication) });
}

export async function rejectApplication(req: Request, res: Response) {
  const input = rejectApplicationSchema.parse(req.body);
  const existing = await prisma.admissionApplication.findUnique({ where: { id: req.params.id } });
  if (!existing) throw AppError.notFound("Application not found.");
  if (existing.status !== "new") throw AppError.conflict("That application was already reviewed.");
  await prisma.admissionApplication.update({
    where: { id: existing.id },
    data: { status: "rejected", reviewNote: input.reviewNote ?? null },
  });
  res.status(204).send();
}
