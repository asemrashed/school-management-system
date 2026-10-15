import type { Prisma } from "@prisma/client";
import {
  DEFAULT_SITE,
  SITE_SCHEMAS,
  type PublicSite,
  type SiteKey,
  type GeneralSettings,
  type HomeSettings,
  type AdmissionSettings,
} from "@packages/shared-types";
import { prisma } from "../lib/prisma";

/**
 * Site settings are stored as JSON per key. Reads always merge the stored
 * value over the defaults and re-validate, so (a) a brand-new install shows a
 * complete site, and (b) a field added in a later release never crashes the
 * page for settings saved before it existed.
 */
export async function readSetting<K extends SiteKey>(key: K): Promise<(typeof DEFAULT_SITE)[K]> {
  const row = await prisma.siteSetting.findUnique({ where: { key } });
  const merged = { ...DEFAULT_SITE[key], ...((row?.value as object | null) ?? {}) };
  const parsed = SITE_SCHEMAS[key].safeParse(merged);
  return (parsed.success ? parsed.data : DEFAULT_SITE[key]) as (typeof DEFAULT_SITE)[K];
}

export async function writeSetting(key: SiteKey, value: unknown): Promise<void> {
  const json = value as Prisma.InputJsonValue;
  await prisma.siteSetting.upsert({ where: { key }, update: { value: json }, create: { key, value: json } });
}

export async function readPublicSite(): Promise<PublicSite> {
  const [general, home, admission, teachers, gallery, notices, events, classes, school] = await Promise.all([
    readSetting("general") as Promise<GeneralSettings>,
    readSetting("home") as Promise<HomeSettings>,
    readSetting("admission") as Promise<AdmissionSettings>,
    prisma.teacher.findMany({
      where: { deletedAt: null, showOnWebsite: true, user: { isActive: true, deletedAt: null } },
      include: { user: true },
      orderBy: [{ websiteOrder: "asc" }],
    }),
    prisma.galleryImage.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] }),
    prisma.notice.findMany({
      where: { deletedAt: null, status: "published", publishedAt: { not: null }, audience: "all" },
      orderBy: { publishedAt: "desc" },
      take: 5,
    }),
    prisma.event.findMany({ where: { deletedAt: null, startAt: { gte: new Date() } }, orderBy: { startAt: "asc" }, take: 4 }),
    prisma.class.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.school.findFirst({ where: { deletedAt: null } }),
  ]);

  // Until an admin edits the name, show the real school name from the seed.
  const stored = await prisma.siteSetting.findUnique({ where: { key: "general" } });
  const schoolName = (stored?.value as { schoolName?: string } | null)?.schoolName ?? school?.name ?? general.schoolName;

  return {
    general: { ...general, schoolName },
    home,
    admission,
    teachers: teachers.map((t) => ({
      id: t.id,
      name: t.user.name,
      designation: t.designation ?? t.subject,
      bio: t.bio,
      photoUrl: t.photoUrl,
    })),
    gallery: gallery.map((g) => ({ id: g.id, url: g.url, caption: g.caption, album: g.album })),
    notices: notices.map((n) => ({ id: n.id, title: n.title, publishedAt: n.publishedAt?.toISOString() ?? null })),
    events: events.map((e) => ({ id: e.id, title: e.title, startAt: e.startAt.toISOString(), location: e.location })),
    classes: classes.map((c) => ({ id: c.id, name: c.name })),
  };
}
