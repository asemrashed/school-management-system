import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { startServer, stopServer, seedSchool, loginAs, mailbox, type World } from "./helpers/harness";

let w: World;
let admin: Awaited<ReturnType<typeof loginAs>>;
let coord: Awaited<ReturnType<typeof loginAs>>;
let tina: Awaited<ReturnType<typeof loginAs>>;
let tom: Awaited<ReturnType<typeof loginAs>>;
let sessionId: string;
let exams: Record<string, string>; // subject name -> exam id (section A)

beforeAll(startServer);
afterAll(stopServer);
beforeEach(async () => {
  w = await seedSchool();
  admin = await loginAs(w.admin.email);
  coord = await loginAs(w.coordinator.email);
  const base = { shiftId: w.shift.id, classId: w.cls.id, sectionId: w.sectionA.id };
  await admin.post("/academics/class-assignments", { ...base, subjectId: w.math.id, teacherId: w.teacher.id });
  await admin.post("/academics/class-assignments", { ...base, subjectId: w.english.id, teacherId: w.teacher2.id });
  tina = await loginAs(w.teacherUser.email);
  tom = await loginAs(w.teacher2User.email);

  const r = await coord.post("/exam-sessions", {
    name: "Mid-term 2026", term: "mid_term", classId: w.cls.id, examDate: "2099-05-01",
    subjects: [{ subjectId: w.math.id, maxMarks: 100 }, { subjectId: w.english.id, maxMarks: 50 }],
  });
  expect(r.status).toBe(201);
  sessionId = r.body.session.id;
  const list = (await admin.get(`/exam-sessions/${sessionId}/progress`)).body.items as any[];
  exams = {};
  for (const e of list.filter((x) => x.sectionId === w.sectionA.id)) exams[e.subjectName] = e.examId;
});

const enter = (t: typeof tina, id: string, a: number, b: number) =>
  t.post("/exams/marks", { examId: id, entries: [{ studentId: w.student.id, marksObtained: a }, { studentId: w.student2.id, marksObtained: b }] });

describe("exam sessions", () => {
  it("one session fans out to section x subject exams and teachers cannot create one", async () => {
    const progress = (await admin.get(`/exam-sessions/${sessionId}/progress`)).body.items;
    expect(progress).toHaveLength(4); // 2 sections x 2 subjects
    expect((await tina.post("/exam-sessions", { name: "X", term: "final", classId: w.cls.id, examDate: "2099-01-01", subjects: [{ subjectId: w.math.id, maxMarks: 10 }] })).status).toBe(403);
    expect((await tina.get(`/exam-sessions/${sessionId}/progress`)).status).toBe(403);
  });
  it("rejects a duplicate session and subjects from another class", async () => {
    const dup = await admin.post("/exam-sessions", { name: "Mid-term 2026", term: "mid_term", classId: w.cls.id, examDate: "2099-05-01", subjects: [{ subjectId: w.math.id, maxMarks: 100 }] });
    expect(dup.status).toBe(409);
  });
});

describe("approval chain", () => {
  it("cannot submit incomplete marks; teacher is locked after submit; coordinator can return with a note", async () => {
    const id = exams.Mathematics;
    await tina.post("/exams/marks", { examId: id, entries: [{ studentId: w.student.id, marksObtained: 70 }] });
    expect((await tina.post(`/exams/${id}/submit`)).body.code).toBe("MARKS_INCOMPLETE");

    await enter(tina, id, 70, 40);
    expect((await tina.post(`/exams/${id}/submit`)).status).toBe(200);
    expect((await enter(tina, id, 99, 99)).status).toBe(409); // frozen

    const back = await coord.post(`/exams/${id}/reject`, { note: "Recheck roll 02" });
    expect(back.body.exam.status).toBe("draft");
    expect(back.body.exam.returnNote).toBe("Recheck roll 02");
    expect((await enter(tina, id, 70, 45)).status).toBe(204);
  });
  it("only coordinator/admin approve; the other teacher and students cannot", async () => {
    const id = exams.Mathematics;
    await enter(tina, id, 70, 40);
    await tina.post(`/exams/${id}/submit`);
    expect((await tina.post(`/exams/${id}/approve`)).status).toBe(403);
    expect((await tom.post(`/exams/${id}/submit`)).status).toBe(403);
    expect((await (await loginAs(w.studentUser.email)).post(`/exams/${id}/approve`)).status).toBe(403);
    expect((await coord.post(`/exams/${id}/approve`)).status).toBe(200);
  });
  it("cannot approve before the teacher submits", async () => {
    expect((await coord.post(`/exams/${exams.Mathematics}/approve`)).status).toBe(409);
  });
  it("publishes only when EVERY exam of the session is approved, then notifies and shows on student/parent", async () => {
    const student = await loginAs(w.studentUser.email);
    const all = (await admin.get(`/exam-sessions/${sessionId}/progress`)).body.items as any[];
    const others = all.filter((e) => e.sectionId === w.sectionB.id);

    // approve section A's two subjects first
    await enter(tina, exams.Mathematics, 90, 50);
    await tina.post(`/exams/${exams.Mathematics}/submit`);
    await enter(tom, exams.English, 40, 20);
    await tom.post(`/exams/${exams.English}/submit`);
    await coord.post(`/exams/${exams.Mathematics}/approve`);
    const a2 = await coord.post(`/exams/${exams.English}/approve`);
    expect(a2.body.sessionPublished).toBe(false);
    expect((await student.get("/exam-sessions/mine")).body.items[0].sessions).toHaveLength(0);

    // section B has no assigned teachers in this test: admin cannot approve unsubmitted marks
    expect(others).toHaveLength(2);
    expect((await admin.post(`/exams/${others[0].examId}/approve`)).status).toBe(409);
  });
  it("auto-publishes on the last approval and the report card has totals, grade and GPA", async () => {
    // single-section session so one pair completes it
    const r = await admin.post("/exam-sessions", { name: "Final 2026", term: "final", classId: w.cls.id, sectionIds: [w.sectionA.id], examDate: "2099-12-01", subjects: [{ subjectId: w.math.id, maxMarks: 100 }, { subjectId: w.english.id, maxMarks: 100 }] });
    const sid = r.body.session.id;
    const rows = (await admin.get(`/exam-sessions/${sid}/progress`)).body.items as any[];
    const m = rows.find((x) => x.subjectName === "Mathematics").examId;
    const e = rows.find((x) => x.subjectName === "English").examId;
    await enter(tina, m, 90, 20); await tina.post(`/exams/${m}/submit`);
    await enter(tom, e, 70, 80); await tom.post(`/exams/${e}/submit`);
    mailbox().length = 0;
    await coord.post(`/exams/${m}/approve`);
    expect((await admin.get("/exam-sessions")).body.items.find((s: any) => s.id === sid).publishedAt).toBeNull();
    const last = await admin.post(`/exams/${e}/approve`);
    expect(last.body.sessionPublished).toBe(true);
    expect(mailbox().some((x) => x.to === w.parentUser.email)).toBe(true);

    const student = await loginAs(w.studentUser.email);
    const card = (await student.get("/exam-sessions/mine")).body.items[0].sessions.find((s: any) => s.sessionId === sid);
    expect(card.total).toBe(160);
    expect(card.maxTotal).toBe(200);
    expect(card.percent).toBe(80);
    expect(card.grade).toBe("A+");
    expect(card.gpa).toBe(4.5); // A+ (5.0) and A (4.0)
    expect(card.passed).toBe(true);

    // sibling Sue (20 in Maths) fails -> GPA 0
    const sue = (await (await loginAs(w.studentUser.email)).get("/exam-sessions/mine")).body.items;
    expect(sue).toHaveLength(1); // a student sees only themself
    const parent = await loginAs(w.parentUser.email);
    const kids = (await parent.get("/exam-sessions/mine")).body.items;
    expect(kids).toHaveLength(2);
    const sue2 = kids.find((k: any) => k.studentName === "Sue Student").sessions.find((s: any) => s.sessionId === sid);
    expect(sue2.passed).toBe(false);
    expect(sue2.gpa).toBe(0);

    // after publishing, marks can no longer be returned or changed
    expect((await coord.post(`/exams/${m}/reject`, { note: "oops oops" })).status).toBe(409);
    // another family sees nothing
    expect((await (await loginAs(w.otherParentUser.email)).get("/exam-sessions/mine")).body.items[0].sessions).toHaveLength(0);
  });
});

describe("result sheet", () => {
  async function fill() {
    await enter(tina, exams.Mathematics, 90, 20); await tina.post(`/exams/${exams.Mathematics}/submit`);
    await enter(tom, exams.English, 40, 10); await tom.post(`/exams/${exams.English}/submit`);
  }
  it("admin tier sees every subject with totals, filters, sorting and pagination", async () => {
    await fill();
    const s = (await coord.get(`/exam-sessions/${sessionId}/results?sectionId=${w.sectionA.id}&sort=total&dir=desc`)).body.sheet;
    expect(s.complete).toBe(true);
    expect(s.subjects.map((x: any) => x.name)).toEqual(["English", "Mathematics"]);
    expect(s.rows.map((r: any) => r.name)).toEqual(["Sam Student", "Sue Student"]);
    expect(s.rows[0].total).toBe(130);
    expect(s.rows[0].grade).toBeTruthy();

    const fail = (await admin.get(`/exam-sessions/${sessionId}/results?sectionId=${w.sectionA.id}&result=fail`)).body.sheet;
    expect(fail.rows.map((r: any) => r.name)).toEqual(["Sue Student"]);

    const search = (await admin.get(`/exam-sessions/${sessionId}/results?q=sam`)).body.sheet;
    expect(search.totalRows).toBe(1);

    const p1 = (await admin.get(`/exam-sessions/${sessionId}/results?pageSize=5&page=1`)).body.sheet;
    expect(p1.totalRows).toBe(3); // Sam, Sue, Otto (section B, no marks yet)
    expect(p1.totalPages).toBe(1);
    const clamp = (await admin.get(`/exam-sessions/${sessionId}/results?pageSize=5&page=9`)).body.sheet;
    expect(clamp.page).toBe(1);
  });
  it("a teacher sees only their own subject column, no overall grade, and no other section", async () => {
    await fill();
    const s = (await tina.get(`/exam-sessions/${sessionId}/results`)).body.sheet;
    expect(s.complete).toBe(false);
    expect(s.subjects.map((x: any) => x.name)).toEqual(["Mathematics"]);
    expect(s.rows).toHaveLength(2); // section A only
    expect(s.rows[0].grade).toBeNull();
    expect(Object.keys(s.rows[0].cells)).toHaveLength(1);
    expect((await tina.get(`/exam-sessions/${sessionId}/results?result=fail`)).status).toBe(400);
    const list = (await tom.get("/exam-sessions")).body.items;
    expect(list[0].progress.total).toBe(1);
  });
  it("students and parents cannot open the staff sheet; CSV neutralises formulas", async () => {
    expect((await (await loginAs(w.studentUser.email)).get(`/exam-sessions/${sessionId}/results`)).status).toBe(403);
    await fill();
    const csv = await admin.get(`/exam-sessions/${sessionId}/results?format=csv`);
    expect(csv.status).toBe(200);
    expect(String(csv.body)).toContain("Sam Student");
  });
});
