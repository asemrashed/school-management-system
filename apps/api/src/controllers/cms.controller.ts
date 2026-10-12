import type { Request, Response } from "express";
import { createPageSchema, updatePageSchema, type PageDto } from "@packages/shared-types";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { sanitizeHtml } from "../lib/sanitize";

function toPageDto(row: {
  id: string;
  slug: string;
  title: string;
  bodyHtml: string;
  status: string;
  publishedAt: Date | null;
  updatedAt: Date;
}): PageDto {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    bodyHtml: row.bodyHtml,
    status: row.status as PageDto["status"],
    publishedAt: row.publishedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listPages(_req: Request, res: Response) {
  const rows = await prisma.page.findMany({ where: { deletedAt: null }, orderBy: { updatedAt: "desc" } });
  res.json({ items: rows.map(toPageDto) });
}

/** Draft -> Review -> Published (cms-domain.md): coordinators may author and
 * edit, but only admin / super_admin can put a page live on the public site. */
function assertMayPublish(req: Request) {
  if (req.user!.role === "coordinator") {
    throw AppError.forbidden("Only an admin can publish public pages. Save as draft for review instead.");
  }
}

export async function createPage(req: Request, res: Response) {
  const input = createPageSchema.parse(req.body);
  if (input.status === "published") assertMayPublish(req);
  const existing = await prisma.page.findUnique({ where: { slug: input.slug } });
  if (existing) throw AppError.conflict("A page with this slug already exists.");

  const row = await prisma.page.create({
    data: {
      ...input,
      bodyHtml: sanitizeHtml(input.bodyHtml),
      createdById: req.user!.id,
      publishedAt: input.status === "published" ? new Date() : null,
    },
  });
  res.status(201).json({ page: toPageDto(row) });
}

export async function updatePage(req: Request, res: Response) {
  const { id } = req.params;
  const input = updatePageSchema.parse(req.body);
  const existing = await prisma.page.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("Page not found.");

  if (input.status === "published" || existing.status === "published") {
    // Coordinators can neither publish nor edit/unpublish live pages.
    assertMayPublish(req);
  }
  if (input.slug && input.slug !== existing.slug) {
    const clash = await prisma.page.findUnique({ where: { slug: input.slug } });
    if (clash) throw AppError.conflict("A page with this slug already exists.");
  }

  const becomingPublished = input.status === "published" && existing.status !== "published";
  const row = await prisma.page.update({
    where: { id },
    data: {
      ...input,
      bodyHtml: input.bodyHtml ? sanitizeHtml(input.bodyHtml) : undefined,
      publishedAt: becomingPublished ? new Date() : undefined,
    },
  });
  res.json({ page: toPageDto(row) });
}
