import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { Client, startServer, stopServer, seedSchool, loginAs, db, mailbox, type World } from "./helpers/harness";

let w: World;
beforeAll(startServer);
afterAll(stopServer);
beforeEach(async () => {
  w = await seedSchool();
  // Teachers may only run exams for subjects they are assigned to teach.
  const admin = await loginAs(w.admin.email);
  await admin.post("/academics/class-assignments", { shiftId: w.shift.id, classId: w.cls.id, sectionId: w.sectionA.id, subjectId: w.math.id, teacherId: w.teacher.id });
  await admin.post("/academics/class-assignments", { shiftId: w.shift.id, classId: w.cls.id, sectionId: w.sectionB.id, subjectId: w.english.id, teacherId: w.teacher.id });
});

async function createExam(teacher: Client) {
  const r = await teacher.post("/exams", { name: "Mid-term", type: "offline", subjectId: w.math.id, sectionId: w.sectionA.id, examDate: "2026-01-15", maxMarks: 100 });
  return r.body.exam;
}

describe("exams & marks — result-publish gating and locking", () => {
  it("marks are invisible to students/parents before publish, and staff can see them", async () => {
    const teacher = await loginAs(w.teacherUser.email);
    const exam = await createExam(teacher);
    await teacher.post("/exams/marks", { examId: exam.id, entries: [{ studentId: w.student.id, marksObtained: 88 }] });

    const student = await loginAs(w.studentUser.email);
    expect((await student.get(`/exams/${exam.id}/marks`)).body.items).toHaveLength(0);
    expect((await student.get("/exams")).body.items).toHaveLength(0); // exam itself hidden until published

    const admin = await loginAs(w.admin.email);
    expect((await admin.get(`/exams/${exam.id}/marks`)).body.items).toHaveLength(1);
  });
  it("publishing locks marks entry and notifies the guardian with the score", async () => {
    const teacher = await loginAs(w.teacherUser.email);
    const exam = await createExam(teacher);
    await teacher.post("/exams/marks", { examId: exam.id, entries: [{ studentId: w.student.id, marksObtained: 91 }] });
    mailbox().length = 0;

    const pub = await teacher.post("/exams/publish", { examId: exam.id });
    expect(pub.status).toBe(200);
    expect(pub.body.exam.publishedAt).not.toBeNull();
    expect(mailbox().some((m) => m.to === w.parentUser.email && /91/.test(m.html))).toBe(true);

    const student = await loginAs(w.studentUser.email);
    const marks = await student.get(`/exams/${exam.id}/marks`);
    expect(marks.body.items[0].marksObtained).toBe(91);

    const relock = await teacher.post("/exams/marks", { examId: exam.id, entries: [{ studentId: w.student.id, marksObtained: 10 }] });
    expect(relock.status).toBe(409);
  });
  it("a student only ever sees their own mark for a published exam, never a classmate's", async () => {
    const teacher = await loginAs(w.teacherUser.email);
    const exam = await createExam(teacher);
    await teacher.post("/exams/marks", { examId: exam.id, entries: [{ studentId: w.student.id, marksObtained: 70 }, { studentId: w.student2.id, marksObtained: 95 }] });
    await teacher.post("/exams/publish", { examId: exam.id });
    const student = await loginAs(w.studentUser.email);
    const marks = await student.get(`/exams/${exam.id}/marks`);
    expect(marks.body.items).toHaveLength(1);
    expect(marks.body.items[0].marksObtained).toBe(70);
  });
  it("a parent from a different family never sees another family's exam results", async () => {
    const teacher = await loginAs(w.teacherUser.email);
    const examB = await teacher.post("/exams", { name: "B test", type: "offline", subjectId: w.english.id, sectionId: w.sectionB.id, examDate: "2026-01-20", maxMarks: 50 });
    // otherStudent is in sectionB; grade+publish it
    await teacher.post("/exams/marks", { examId: examB.body.exam.id, entries: [{ studentId: w.otherStudent.id, marksObtained: 40 }] });
    await teacher.post("/exams/publish", { examId: examB.body.exam.id });

    const parentA = await loginAs(w.parentUser.email); // parent of sectionA students only
    const exams = await parentA.get("/exams");
    expect(exams.body.items.some((e: any) => e.id === examB.body.exam.id)).toBe(false);
  });
  it("a student cannot create an exam or enter marks", async () => {
    const student = await loginAs(w.studentUser.email);
    expect((await student.post("/exams", { name: "x", type: "offline", subjectId: w.math.id, sectionId: w.sectionA.id, examDate: "2026-01-01", maxMarks: 10 })).status).toBe(403);
    const teacher = await loginAs(w.teacherUser.email);
    const exam = await createExam(teacher);
    expect((await student.post("/exams/marks", { examId: exam.id, entries: [{ studentId: w.student.id, marksObtained: 100 }] })).status).toBe(403);
  });
});
