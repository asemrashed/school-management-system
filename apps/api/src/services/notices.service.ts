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

export async function createAndMaybePublishNotice(input: {
  title: string;
  bodyHtml: string;
  audience: string;
  publishNow: boolean;
  createdById: string;
}) {
  const cleanHtml = sanitizeHtml(input.bodyHtml);

  const notice = await prisma.notice.create({
    data: {
      title: input.title,
      bodyHtml: cleanHtml,
      audience: input.audience as any,
      createdById: input.createdById,
      publishedAt: input.publishNow ? new Date() : null,
    },
  });

  if (input.publishNow) {
    await publishNoticeNotifications(notice.id);
  }

  return notice;
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
