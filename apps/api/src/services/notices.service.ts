import { prisma } from "../lib/prisma";
import { sanitizeHtml } from "../lib/sanitize";
import { notify } from "./notification.service";

const AUDIENCE_TO_ROLES: Record<string, string[]> = {
  all: ["parent", "teacher", "student", "admin", "coordinator", "accountant", "librarian"],
  parents: ["parent"],
  teachers: ["teacher"],
  students: ["student"],
  staff: ["admin", "coordinator", "accountant", "librarian", "teacher"],
};

/** Audiences a role is allowed to read. `null` = unrestricted (admin tier,
 * who author notices and need to see them all). */
export function readableAudiences(role: string): string[] | null {
  switch (role) {
    case "super_admin":
    case "admin":
    case "coordinator":
      return null;
    case "parent":
      return ["all", "parents"];
    case "student":
      return ["all", "students"];
    case "teacher":
      return ["all", "teachers", "staff"];
    default: // accountant, librarian
      return ["all", "staff"];
  }
}

/** Roles whose notices go live immediately; everyone else's wait for an admin. */
export const DIRECT_PUBLISH_ROLES = ["super_admin", "admin"];

/**
 * Admin / super admin: publish now (or keep a draft).
 * Coordinator / teacher / librarian: ALWAYS `pending` — `publishNow` from the
 * client is ignored, so a staff member can never publish by tampering with it.
 */
export async function createNotice(input: {
  title: string;
  bodyHtml: string;
  audience: string;
  publishNow: boolean;
  createdById: string;
  authorRole: string;
}) {
  const direct = DIRECT_PUBLISH_ROLES.includes(input.authorRole);
  const status = !direct ? "pending" : input.publishNow ? "published" : "draft";

  const notice = await prisma.notice.create({
    data: {
      title: input.title,
      bodyHtml: sanitizeHtml(input.bodyHtml),
      audience: input.audience as any,
      createdById: input.createdById,
      status,
      publishedAt: status === "published" ? new Date() : null,
    },
  });

  if (status === "published") await publishNoticeNotifications(notice.id);
  return notice;
}

/** Author fixes a pending / rejected notice; it goes back to the approval queue. */
export async function resubmitNotice(id: string, input: { title: string; bodyHtml: string; audience: string }) {
  return prisma.notice.update({
    where: { id },
    data: {
      title: input.title,
      bodyHtml: sanitizeHtml(input.bodyHtml),
      audience: input.audience as any,
      status: "pending",
      rejectionNote: null,
      reviewedById: null,
      reviewedAt: null,
    },
  });
}

/**
 * Admin approval. Claims the row with a compare-and-set on `status` so two
 * admins clicking at once publish (and email everyone) exactly once.
 */
export async function approveNotice(id: string, reviewerId: string): Promise<boolean> {
  const claimed = await prisma.notice.updateMany({
    where: { id, status: "pending", deletedAt: null },
    data: { status: "published", publishedAt: new Date(), reviewedById: reviewerId, reviewedAt: new Date(), rejectionNote: null },
  });
  if (claimed.count === 0) return false;
  await publishNoticeNotifications(id);
  return true;
}

export async function rejectNotice(id: string, reviewerId: string, note: string): Promise<boolean> {
  const claimed = await prisma.notice.updateMany({
    where: { id, status: "pending", deletedAt: null },
    data: { status: "rejected", reviewedById: reviewerId, reviewedAt: new Date(), rejectionNote: note, publishedAt: null },
  });
  return claimed.count > 0;
}

/**
 * Publishing a notice triggers the `general_notice` category via the
 * single notification service — never an inline SMTP/SMS call
 * (cms-domain.md).
 */
export async function publishNoticeNotifications(noticeId: string) {
  const notice = await prisma.notice.findUnique({ where: { id: noticeId } });
  if (!notice) return;

  const roles = AUDIENCE_TO_ROLES[notice.audience] ?? AUDIENCE_TO_ROLES.all;
  const recipients = await prisma.user.findMany({
    where: { role: { in: roles as any }, isActive: true, deletedAt: null },
  });

  for (const recipient of recipients) {
    await notify({
      category: "general_notice",
      recipientEmail: recipient.email,
      subject: notice.title,
      html: notice.bodyHtml,
    });
  }
}
