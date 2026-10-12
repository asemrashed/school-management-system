import { z } from "zod";

/**
 * Cursor-based pagination request (preferred for large lists).
 */
export const cursorPaginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type CursorPaginationQuery = z.infer<typeof cursorPaginationQuerySchema>;

/**
 * Offset-based pagination request (small/admin lists).
 */
export const offsetPaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type OffsetPaginationQuery = z.infer<typeof offsetPaginationQuerySchema>;

/**
 * Standard list response envelope (see api-contract.md).
 */
export function paginatedResponseSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable().optional(),
    total: z.number().int().optional(),
  });
}

/**
 * Standard error shape (see error-handling-logging.md).
 */
export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export const idParamSchema = z.object({
  id: z.string().min(1),
});
