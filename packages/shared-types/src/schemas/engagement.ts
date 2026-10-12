import { z } from "zod";

export const NOTICE_AUDIENCES = ["all", "parents", "teachers", "students", "staff"] as const;
export const noticeAudienceSchema = z.enum(NOTICE_AUDIENCES);
export type NoticeAudience = z.infer<typeof noticeAudienceSchema>;

export const noticeDtoSchema = z.object({
  id: z.string(),
  title: z.string(),
  bodyHtml: z.string(),
  audience: noticeAudienceSchema,
  publishedAt: z.string().nullable(),
  createdByName: z.string(),
  createdAt: z.string(),
});
export type NoticeDto = z.infer<typeof noticeDtoSchema>;

/** bodyHtml arrives from RichTextEditor and MUST be sanitized again on the
 * server before it is stored (cms-domain.md, CLAUDE.md DOMPurify rule). */
export const createNoticeSchema = z.object({
  title: z.string().min(2).max(160),
  bodyHtml: z.string().min(1),
  audience: noticeAudienceSchema,
  publishNow: z.boolean().default(true),
});
export type CreateNoticeInput = z.infer<typeof createNoticeSchema>;

export const eventDtoSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  startAt: z.string(),
  endAt: z.string().nullable(),
  location: z.string().nullable(),
});
export type EventDto = z.infer<typeof eventDtoSchema>;

export const createEventSchema = z
  .object({
    title: z.string().min(2).max(160),
    description: z.string().max(2000).optional(),
    startAt: z.string().datetime(),
    endAt: z.string().datetime().optional(),
    location: z.string().max(160).optional(),
  })
  .refine((v) => !v.endAt || new Date(v.endAt) >= new Date(v.startAt), {
    message: "End time must be after the start time.",
    path: ["endAt"],
  });
export type CreateEventInput = z.infer<typeof createEventSchema>;

// --- Parent inquiry (ticket-style) ---

export const TICKET_STATUSES = ["open", "in_progress", "resolved"] as const;
export const ticketStatusSchema = z.enum(TICKET_STATUSES);
export type TicketStatus = z.infer<typeof ticketStatusSchema>;

export const ticketMessageDtoSchema = z.object({
  id: z.string(),
  senderId: z.string(),
  senderName: z.string(),
  body: z.string(),
  createdAt: z.string(),
});
export type TicketMessageDto = z.infer<typeof ticketMessageDtoSchema>;

export const ticketDtoSchema = z.object({
  id: z.string(),
  subject: z.string(),
  status: ticketStatusSchema,
  createdByName: z.string(),
  createdAt: z.string(),
  messages: z.array(ticketMessageDtoSchema),
});
export type TicketDto = z.infer<typeof ticketDtoSchema>;

export const createTicketSchema = z.object({
  subject: z.string().min(2).max(160),
  body: z.string().min(1).max(4000),
});
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const addTicketMessageSchema = z.object({
  body: z.string().min(1).max(4000),
});
export type AddTicketMessageInput = z.infer<typeof addTicketMessageSchema>;

export const updateTicketStatusSchema = z.object({
  status: ticketStatusSchema,
});
