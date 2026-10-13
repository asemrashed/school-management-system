import { prisma } from "../lib/prisma";
import { notify } from "./notification.service";

/**
 * Exam → Marks entry → Result compute → Publish → notify parent
 * (lms-domain.md, category `result_published`). "Compute" is just the
 * stored marks themselves in this phase — publishing is what makes them
 * visible and fires the notification.
 */
export async function publishExam(examId: string) {
  // (also used for stand-alone exams that have no session)
  const exam = await prisma.exam.update({
    where: { id: examId },
    data: { publishedAt: new Date() },
    include: {
      subject: true,
      section: true,
      marks: { include: { student: { include: { user: true, guardian: { include: { user: true } } } } } },
    },
  });

  for (const mark of exam.marks) {
    const guardian = mark.student.guardian;
    if (!guardian) continue;
    await notify({
      category: "result_published",
      recipientEmail: guardian.user.email,
      recipientPhone: guardian.phone,
      subject: `${mark.student.user.name}'s result for ${exam.name}`,
      html: `<p>${mark.student.user.name} scored ${mark.marksObtained}/${exam.maxMarks} in ${exam.subject.name} (${exam.name}).</p>`,
      smsBody: `${mark.student.user.name} scored ${mark.marksObtained}/${exam.maxMarks} in ${exam.name}.`,
    });
  }

  return exam;
}

/**
 * Publishes the whole session once EVERY (non-deleted) exam in it is approved.
 * Idempotent: a second call after publishing does nothing. Returns whether the
 * session is (now) published.
 */
export async function publishSessionIfComplete(sessionId: string): Promise<boolean> {
  const session = await prisma.examSession.findUnique({ where: { id: sessionId } });
  if (!session || session.deletedAt) return false;
  if (session.publishedAt) return true;
  const exams = await prisma.exam.findMany({ where: { sessionId, deletedAt: null } });
  if (exams.length === 0 || exams.some((e) => !e.approvedAt)) return false;

  // Claim the session first so two concurrent last-approvals cannot both notify.
  const claimed = await prisma.examSession.updateMany({
    where: { id: sessionId, publishedAt: null },
    data: { publishedAt: new Date() },
  });
  if (claimed.count === 0) return true;
  for (const e of exams) await publishExam(e.id);
  return true;
}
