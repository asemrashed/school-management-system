import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";

export async function getPublicPage(req: Request, res: Response) {
  const slug = req.params.slug;
  const page = await prisma.page.findFirst({
    where: { slug, status: "published", deletedAt: null },
  });
  if (!page) throw AppError.notFound("Page not found.");
  res.json({
    page: {
      slug: page.slug,
      title: page.title,
      bodyHtml: page.bodyHtml,
      publishedAt: page.publishedAt?.toISOString() ?? null,
    },
  });
}

/** Public notice board (cms-domain.md route `/notice`) — same published
 * notices any logged-in user sees, just without requiring a session. */
export async function listPublicNotices(_req: Request, res: Response) {
  const rows = await prisma.notice.findMany({
    where: { deletedAt: null, status: "published", publishedAt: { not: null }, audience: "all" },
    orderBy: { publishedAt: "desc" },
    take: 30,
  });
  res.json({
    items: rows.map((n) => ({
      id: n.id,
      title: n.title,
      bodyHtml: n.bodyHtml,
      publishedAt: n.publishedAt?.toISOString() ?? null,
    })),
  });
}
