import { z } from "zod";

/// Must stay in sync with the Prisma ResourceKind enum.
export const RESOURCE_KINDS = ["pdf", "video", "slides", "recorded_class", "live_link", "past_paper", "notes", "other"] as const;
export const resourceKindSchema = z.enum(RESOURCE_KINDS);
export type ResourceKind = z.infer<typeof resourceKindSchema>;

export const resourceDtoSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: resourceKindSchema,
  url: z.string(),
  classId: z.string(),
  sectionId: z.string(),
  subjectId: z.string(),
  subjectName: z.string(),
  teacherName: z.string(),
  scheduledAt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type ResourceDto = z.infer<typeof resourceDtoSchema>;

/**
 * `url` is a direct link for now (Cloudinary/Drive/YouTube/etc.) — real
 * file upload will populate this automatically once a storage provider SDK
 * is wired in (packages/config/src/providers/storage.ts). See
 * lms-domain.md: "Resource belongs to (class, section, subject, teacher)."
 */
export const createResourceSchema = z.object({
  title: z.string().min(2).max(160),
  kind: resourceKindSchema,
  url: z.string().url(),
  classId: z.string(),
  sectionId: z.string(),
  subjectId: z.string(),
  scheduledAt: z.string().datetime().optional(),
  publishNow: z.boolean().default(true),
});
export type CreateResourceInput = z.infer<typeof createResourceSchema>;
