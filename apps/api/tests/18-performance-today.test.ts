import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { startServer, stopServer, seedSchool, loginAs, db, type World } from "./helpers/harness";

let w: World;
beforeAll(async () => { await startServer(); });
afterAll(stopServer);
beforeEach(async () => { w = await seedSchool(); });

const day = (offset: number) => new Date(Date.UTC(2026, 0, 10 + offset));

async function seedResults() {
  const d = db();
  for (let i = 0; i < 4; i++) {
    await d.attendance.create({ data: { studentId: w.student.id, sectionId: w.sectionA.id, date: day(i), status: ["present", "present", "late", "absent"][i] } });
  }
  const pub = await d.exam.create({ data: { name: "Midterm", subjectId: w.math.id, sectionId: w.sectionA.id, examDate: day(5), maxMarks: 100, type: "offline", publishedAt: new Date() } });
  const draft = await d.exam.create({ data: { name: "Quiz", subjectId: w.english.id, sectionId: w.sectionA.id, examDate: day(6), maxMarks: 20, type: "offline" } });
  await d.mark.create({ data: { examId: pub.id, studentId: w.student.id, marksObtained: 80 } });
  await d.mark.create({ data: { examId: draft.id, studentId: w.student.id, marksObtained: 5 } });
}

describe("student performance report", () => {
  it("computes attendance, subject averages and hides unpublished marks", async () => {
    await seedResults();
    const parent = await loginAs(w.parentUser.email);
    const p = (await parent.get(`/students/${w.student.id}/performance`)).body.performance;
    expect(p.attendance).toMatchObject({ total: 4, present: 2, late: 1, absent: 1, percent: 75 });
    expect(p.overallPercent).toBe(80);
    expect(p.subjects).toEqual([{ subjectName: "Mathematics", examsCount: 1, averagePercent: 80 }]);
    expect(p.exams).toHaveLength(1);
  });

  it("is scoped: own child only for parents, own record for students, section teachers, never other families", async () => {
    const parent = await loginAs(w.parentUser.email);
    expect((await parent.get(`/students/${w.otherStudent.id}/performance`)).status).toBe(403);
    const student = await loginAs(w.studentUser.email);
    expect((await student.get(`/students/${w.student.id}/performance`)).status).toBe(200);
    expect((await student.get(`/students/${w.student2.id}/performance`)).status).toBe(403);
    const teacher = await loginAs(w.teacherUser.email);
    expect((await teacher.get(`/students/${w.student.id}/performance`)).status).toBe(403); // not assigned yet
    await db().classAssignment.create({ data: { sectionId: w.sectionA.id, classId: w.cls.id, shiftId: w.shift.id, subjectId: w.math.id, teacherId: w.teacher.id } });
    expect((await teacher.get(`/students/${w.student.id}/performance`)).status).toBe(200);
    const acc = await loginAs(w.accountant.email);
    expect((await acc.get(`/students/${w.student.id}/performance`)).status).toBe(403);
  });

  it("/students/mine lists a parent's children and a student's own record only", async () => {
    const parent = await loginAs(w.parentUser.email);
    expect((await parent.get("/students/mine")).body.items.map((c: any) => c.name).sort()).toEqual(["Sam Student", "Sue Student"]);
    const student = await loginAs(w.studentUser.email);
    expect((await student.get("/students/mine")).body.items.map((c: any) => c.name)).toEqual(["Sam Student"]);
    expect((await (await loginAs(w.teacherUser.email)).get("/students/mine")).status).toBe(403);
  });
});

describe("teacher 'today' duty", () => {
  it("reports student count and whether today's attendance was taken, for the client's local date", async () => {
    await db().classAssignment.create({ data: { sectionId: w.sectionA.id, classId: w.cls.id, shiftId: w.shift.id, subjectId: w.math.id, teacherId: w.teacher.id, takesAttendance: true } });
    const teacher = await loginAs(w.teacherUser.email);
    let item = (await teacher.get("/attendance/my-sections?date=2026-03-05")).body.items[0];
    expect(item).toMatchObject({ studentCount: 2, takenToday: false, className: "Class 6", sectionName: "A" });
    await db().attendance.create({ data: { studentId: w.student.id, sectionId: w.sectionA.id, date: new Date("2026-03-05T00:00:00.000Z"), status: "present", takenById: w.teacher.id } });
    await db().attendance.create({ data: { studentId: w.student2.id, sectionId: w.sectionA.id, date: new Date("2026-03-05T00:00:00.000Z"), status: "absent", takenById: w.teacher.id } });
    item = (await teacher.get("/attendance/my-sections?date=2026-03-05")).body.items[0];
    expect(item).toMatchObject({ takenToday: true, presentCount: 1, absentCount: 1 });
  });

  it("accepts the new past_paper and notes resource kinds", async () => {
    await db().classAssignment.create({ data: { sectionId: w.sectionA.id, classId: w.cls.id, shiftId: w.shift.id, subjectId: w.math.id, teacherId: w.teacher.id } });
    const teacher = await loginAs(w.teacherUser.email);
    for (const kind of ["past_paper", "notes"]) {
      const res = await teacher.post("/lms/resources", { title: `Maths ${kind}`, kind, url: "https://example.com/x.pdf", subjectId: w.math.id, classId: w.cls.id, sectionId: w.sectionA.id });
      expect(res.status, JSON.stringify(res.body)).toBe(201);
    }
  });
});
