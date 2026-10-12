import { prisma } from "../lib/prisma";
import { notify } from "./notification.service";

/**
 * Exam → Marks entry → Result compute → Publish → notify parent
 * (lms-domain.md, category `result_published`). "Compute" is just the
 * stored marks themselves in this phase — publishing is what makes them
 * visible and fires the notification.
 */
export async function publishExam(examId: string) {
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
