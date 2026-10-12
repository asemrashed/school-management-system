import type { Request, Response } from "express";
import {
  createNoticeSchema,
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

export async function listNotices(req: Request, res: Response) {
  // Audience-scoped: a parent never receives a staff/teacher-only notice.
  const audiences = noticesService.readableAudiences(req.user!.role);
  const rows = await prisma.notice.findMany({
    where: {
      deletedAt: null,
      publishedAt: { not: null },
      ...(audiences ? { audience: { in: audiences as any } } : {}),
    },
    include: { createdBy: true },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });
  const items: NoticeDto[] = rows.map((n) => ({
    id: n.id,
    title: n.title,
    bodyHtml: n.bodyHtml,
    audience: n.audience,
    publishedAt: n.publishedAt?.toISOString() ?? null,
    createdByName: n.createdBy.name,
    createdAt: n.createdAt.toISOString(),
  }));
  res.json({ items });
}

export async function createNotice(req: Request, res: Response) {
  const input = createNoticeSchema.parse(req.body);
  const notice = await noticesService.createAndMaybePublishNotice({
    ...input,
    createdById: req.user!.id,
  });
  res.status(201).json({ notice });
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
