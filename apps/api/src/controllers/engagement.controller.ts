import type { Request, Response } from "express";
import {
  createNoticeSchema,
  updateNoticeSchema,
  rejectNoticeSchema,
  createEventSchema,
  createTicketSchema,
  addTicketMessageSchema,
  updateTicketStatusSchema,
  type NoticeDto,
  type EventDto,
  type TicketDto,
} from "@packages/shared-types";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { sanitizeHtml } from "../lib/sanitize";
import * as noticesService from "../services/notices.service";

// --- Notices ---

type NoticeRow = {
  id: string; title: string; bodyHtml: string; audience: string; publishedAt: Date | null; createdAt: Date;
  status: string; rejectionNote: string | null; createdBy: { name: string };
  reviewedBy?: { name: string } | null;
};

function toNoticeDto(n: NoticeRow, reviewerNames: Map<string, string>, reviewedById?: string | null): NoticeDto {
  return {
    id: n.id,
    title: n.title,
    bodyHtml: n.bodyHtml,
    audience: n.audience as NoticeDto["audience"],
    publishedAt: n.publishedAt?.toISOString() ?? null,
    createdByName: n.createdBy.name,
    createdAt: n.createdAt.toISOString(),
    status: n.status as NoticeDto["status"],
    rejectionNote: n.rejectionNote,
    reviewedByName: reviewedById ? reviewerNames.get(reviewedById) ?? null : null,
  };
}

async function reviewerNames(rows: { reviewedById: string | null }[]) {
  const ids = [...new Set(rows.map((r) => r.reviewedById).filter((x): x is string => Boolean(x)))];
  const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } } }) : [];
  return new Map(users.map((u) => [u.id, u.name]));
}

/** The live notice board: PUBLISHED notices only, scoped to what this role may read. */
export async function listNotices(req: Request, res: Response) {
  const audiences = noticesService.readableAudiences(req.user!.role);
  const rows = await prisma.notice.findMany({
    where: {
      deletedAt: null,
      status: "published",
      publishedAt: { not: null },
      ...(audiences ? { audience: { in: audiences as any } } : {}),
    },
    include: { createdBy: true },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });
  const names = await reviewerNames(rows as any);
  res.json({ items: rows.map((n) => toNoticeDto(n as any, names, (n as any).reviewedById)) });
}

/** The author's own notices in every state, so they can follow approval / fix a rejection. */
export async function listMyNotices(req: Request, res: Response) {
  const rows = await prisma.notice.findMany({
    where: { deletedAt: null, createdById: req.user!.id },
    include: { createdBy: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const names = await reviewerNames(rows as any);
  res.json({ items: rows.map((n) => toNoticeDto(n as any, names, (n as any).reviewedById)) });
}

/** Admin approval queue. */
export async function listPendingNotices(_req: Request, res: Response) {
  const rows = await prisma.notice.findMany({
    where: { deletedAt: null, status: "pending" },
    include: { createdBy: true },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  res.json({ items: rows.map((n) => toNoticeDto(n as any, new Map(), null)) });
}

export async function createNotice(req: Request, res: Response) {
  const input = createNoticeSchema.parse(req.body);
  const notice = await noticesService.createNotice({
    ...input,
    createdById: req.user!.id,
    authorRole: req.user!.role,
  });
  res.status(201).json({ notice: { id: notice.id, status: notice.status, title: notice.title, bodyHtml: notice.bodyHtml } });
}

/** Only the AUTHOR may edit, and only while pending / rejected. Re-submits for approval. */
export async function updateNotice(req: Request, res: Response) {
  const { id } = req.params;
  const input = updateNoticeSchema.parse(req.body);
  const existing = await prisma.notice.findUnique({ where: { id } });
  if (!existing || existing.deletedAt || existing.createdById !== req.user!.id) throw AppError.notFound("Notice not found.");
  if (existing.status === "published") throw AppError.conflict("A published notice cannot be edited.");
  if (noticesService.DIRECT_PUBLISH_ROLES.includes(req.user!.role)) {
    throw AppError.badRequest("USE_CREATE", "Admins publish directly — create a new notice instead.");
  }
  const notice = await noticesService.resubmitNotice(id, input);
  res.json({ notice: { id: notice.id, status: notice.status } });
}

export async function approveNotice(req: Request, res: Response) {
  const { id } = req.params;
  const existing = await prisma.notice.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw AppError.notFound("Notice not found.");
  if (existing.createdById === req.user!.id) {
    throw AppError.forbidden("You cannot approve your own notice.");
  }
  if (!(await noticesService.approveNotice(id, req.user!.id))) {
    throw AppError.conflict("This notice is not waiting for approval (someone else may have handled it).");
  }
  res.json({ ok: true });
}

export async function rejectNotice(req: Request, res: Response) {
  const { id } = req.params;
  const { note } = rejectNoticeSchema.parse(req.body);
  const existing = await prisma.notice.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw AppError.notFound("Notice not found.");
  if (!(await noticesService.rejectNotice(id, req.user!.id, note))) {
    throw AppError.conflict("This notice is not waiting for approval.");
  }
  res.json({ ok: true });
}

// --- Events ---

export async function listEvents(_req: Request, res: Response) {
  const rows = await prisma.event.findMany({
    where: { deletedAt: null, startAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24) } },
    orderBy: { startAt: "asc" },
    take: 50,
  });
  const items: EventDto[] = rows.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    startAt: e.startAt.toISOString(),
    endAt: e.endAt?.toISOString() ?? null,
    location: e.location,
  }));
  res.json({ items });
}

export async function createEvent(req: Request, res: Response) {
  const input = createEventSchema.parse(req.body);
  const event = await prisma.event.create({
    data: {
      title: input.title,
      description: input.description ? sanitizeHtml(input.description) : null,
      startAt: new Date(input.startAt),
      endAt: input.endAt ? new Date(input.endAt) : null,
      location: input.location,
    },
  });
  res.status(201).json({ event });
}

// --- Parent inquiry tickets ---

function toTicketDto(row: {
  id: string;
  subject: string;
  status: string;
  createdBy: { name: string };
  createdAt: Date;
  messages: Array<{ id: string; senderId: string; sender: { name: string }; body: string; createdAt: Date }>;
}): TicketDto {
  return {
    id: row.id,
    subject: row.subject,
    status: row.status as TicketDto["status"],
    createdByName: row.createdBy.name,
    createdAt: row.createdAt.toISOString(),
    messages: row.messages.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      senderName: m.sender.name,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

const TICKET_INCLUDE = {
  createdBy: true,
  messages: { include: { sender: true }, orderBy: { createdAt: "asc" as const } },
};

export async function listTickets(req: Request, res: Response) {
  // Route is limited to parent + admin tier; parents only see their own.
  const where = req.user!.role === "parent" ? { createdById: req.user!.id } : {};
  const rows = await prisma.inquiryTicket.findMany({
    where,
    include: TICKET_INCLUDE,
    orderBy: { updatedAt: "desc" },
  });
  res.json({ items: rows.map(toTicketDto) });
}

export async function createTicket(req: Request, res: Response) {
  const input = createTicketSchema.parse(req.body);
  const ticket = await prisma.inquiryTicket.create({
    data: {
      subject: input.subject,
      createdById: req.user!.id,
      messages: { create: { senderId: req.user!.id, body: input.body } },
    },
    include: TICKET_INCLUDE,
  });
  res.status(201).json({ ticket: toTicketDto(ticket) });
}

export async function addTicketMessage(req: Request, res: Response) {
  const { id } = req.params;
  const input = addTicketMessageSchema.parse(req.body);

  const ticket = await prisma.inquiryTicket.findUnique({ where: { id } });
  if (!ticket) throw AppError.notFound("Ticket not found.");
  if (req.user!.role === "parent" && ticket.createdById !== req.user!.id) {
    throw AppError.forbidden();
  }

  await prisma.ticketMessage.create({
    data: { ticketId: id, senderId: req.user!.id, body: input.body },
  });
  const updated = await prisma.inquiryTicket.update({
    where: { id },
    data: { status: req.user!.role === "parent" ? undefined : "in_progress" },
    include: TICKET_INCLUDE,
  });
  res.status(201).json({ ticket: toTicketDto(updated) });
}

export async function updateTicketStatus(req: Request, res: Response) {
  const { id } = req.params;
  const input = updateTicketStatusSchema.parse(req.body);
  const updated = await prisma.inquiryTicket.update({
    where: { id },
    data: { status: input.status },
    include: TICKET_INCLUDE,
  });
  res.json({ ticket: toTicketDto(updated) });
}
