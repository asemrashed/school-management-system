import { z } from "zod";

export const PAGE_STATUSES = ["draft", "review", "published"] as const;
export const pageStatusSchema = z.enum(PAGE_STATUSES);
export type PageStatus = z.infer<typeof pageStatusSchema>;

export const pageDtoSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  bodyHtml: z.string(),
  status: pageStatusSchema,
  publishedAt: z.string().nullable(),
  updatedAt: z.string(),
});
export type PageDto = z.infer<typeof pageDtoSchema>;

const slugPattern = /^[a-z0-9]+(?:[-/][a-z0-9]+)*$/;

/** bodyHtml is sanitized again server-side before write (cms-domain.md,
 * CLAUDE.md DOMPurify rule) — never trust the client's RichTextEditor
 * output alone. */
export const createPageSchema = z.object({
  slug: z.string().min(1).max(120).regex(slugPattern, "Use lowercase letters, numbers, - and / only"),
  title: z.string().min(2).max(160),
  bodyHtml: z.string().min(1),
  status: pageStatusSchema.default("draft"),
});
export type CreatePageInput = z.infer<typeof createPageSchema>;

export const updatePageSchema = createPageSchema.partial();
export type UpdatePageInput = z.infer<typeof updatePageSchema>;
