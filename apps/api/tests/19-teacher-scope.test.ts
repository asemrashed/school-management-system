import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { startServer, stopServer, seedSchool, loginAs, type World } from "./helpers/harness";

/**
 * Two teachers share Section A: Tina teaches Maths, Tom teaches English.
 * Neither may see, grade or publish the other's work.
 */
let w: World;
let tina: Awaited<ReturnType<typeof loginAs>>;
let tom: Awaited<ReturnType<typeof loginAs>>;
let admin: Awaited<ReturnType<typeof loginAs>>;
let mathExam: string;
let engExam: string;
let mathAssignment: string;

beforeAll(startServer);
afterAll(stopServer);
beforeEach(async () => {
  w = await seedSchool();
  admin = await loginAs(w.admin.email);
  const base = { shiftId: w.shift.id, classId: w.cls.id, sectionId: w.sectionA.id };
  await admin.post("/academics/class-assignments", { ...base, subjectId: w.math.id, teacherId: w.teacher.id });
  await admin.post("/academics/class-assignments", { ...base, subjectId: w.english.id, teacherId: w.teacher2.id });
  tina = await loginAs(w.teacherUser.email);
  tom = await loginAs(w.teacher2User.email);

  const mk = (subjectId: string, name: string) =>
    admin.post("/exams", { name, type: "offline", subjectId, sectionId: w.sectionA.id, examDate: "2099-01-01", maxMarks: 100 });
  mathExam = (await mk(w.math.id, "Maths mid")).body.exam.id;
  engExam = (await mk(w.english.id, "English mid")).body.exam.id;

  mathAssignment = (
    await tina.post("/lms/assignments", { title: "Algebra HW", description: "x", subjectId: w.math.id, sectionId: w.sectionA.id, dueAt: "2099-02-01T00:00:00.000Z" })
  ).body.assignment.id;
  await tina.post("/lms/resources", { title: "Maths notes", kind: "pdf", url: "https://x/a.pdf", classId: w.cls.id, sectionId: w.sectionA.id, subjectId: w.math.id, publishNow: true });
});

describe("teacher data scope", () => {
  it("assignments: a teacher lists only their own", async () => {
    expect((await tina.get("/lms/assignments")).body.items).toHaveLength(1);
    expect((await tom.get("/lms/assignments")).body.items).toHaveLength(0);
    expect((await admin.get("/lms/assignments")).body.items).toHaveLength(1);
    // Students of the section still see it.
    const student = await loginAs(w.studentUser.email);
    expect((await student.get("/lms/assignments")).body.items).toHaveLength(1);
  });

  it("resources: a teacher lists only their own", async () => {
    expect((await tina.get("/lms/resources")).body.items).toHaveLength(1);
    expect((await tom.get("/lms/resources")).body.items).toHaveLength(0);
  });

  it("submissions: another teacher can neither list nor grade them", async () => {
    const student = await loginAs(w.studentUser.email);
    const sub = await student.post(`/lms/assignments/${mathAssignment}/submissions`, { body: "done" });
    expect(sub.status).toBe(201);
    expect((await tom.get(`/lms/assignments/${mathAssignment}/submissions`)).status).toBe(403);
    expect((await tom.patch(`/lms/submissions/${sub.body.submission.id}`, { grade: 5, publish: true })).status).toBe(403);
    expect((await tina.get(`/lms/assignments/${mathAssignment}/submissions`)).status).toBe(200);
  });

  it("exams: a teacher lists only exams of subjects they teach", async () => {
    const t = (await tina.get("/exams")).body.items.map((e: any) => e.id);
    expect(t).toEqual([mathExam]);
    const o = (await tom.get("/exams")).body.items.map((e: any) => e.id);
    expect(o).toEqual([engExam]);
  });

  it("marks: a teacher cannot read or enter marks for a colleague's exam", async () => {
    expect((await tina.get(`/exams/${engExam}/marks`)).status).toBe(403);
    const r = await tina.post("/exams/marks", { examId: engExam, entries: [{ studentId: w.student.id, marksObtained: 50 }] });
    expect(r.status).toBe(403);
    const ok = await tina.post("/exams/marks", { examId: mathExam, entries: [{ studentId: w.student.id, marksObtained: 50 }] });
    expect(ok.status).toBe(204);
  });

  it("performance: a teacher sees only their own subject's results for a student", async () => {
    for (const [ex, uid] of [[mathExam, tina], [engExam, tom]] as const) {
      await uid.post("/exams/marks", { examId: ex, entries: [{ studentId: w.student.id, marksObtained: 80 }] });
      await admin.post("/exams/publish", { examId: ex });
    }
    const p = await tina.get(`/students/${w.student.id}/performance`);
    expect(p.body.performance.exams.map((e: any) => e.subjectName)).toEqual(["Mathematics"]);
  });

  it("attendance: only the delegated taker may read a section's attendance", async () => {
    const date = "2099-01-01";
    await admin.post("/attendance/taker", { sectionId: w.sectionA.id, teacherId: w.teacher.id });
    expect((await tina.get(`/attendance?sectionId=${w.sectionA.id}&date=${date}`)).status).toBe(200);
    expect((await tom.get(`/attendance?sectionId=${w.sectionA.id}&date=${date}`)).status).toBe(403);
  });

  it("a teacher with no section access cannot read another section's roster", async () => {
    expect((await tina.get(`/academics/sections/${w.sectionB.id}/roster`)).status).toBe(403);
  });
});
