import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { Client, startServer, stopServer, seedSchool, loginAs, db, mailbox, type World } from "./helpers/harness";

let w: World;
beforeAll(startServer);
afterAll(stopServer);
beforeEach(async () => { w = await seedSchool(); });

describe("subjects & class assignments", () => {
  it("admin creates a class assignment; duplicate (section, subject) is rejected", async () => {
    const admin = await loginAs(w.admin.email);
    const r = await admin.post("/academics/class-assignments", { shiftId: w.shift.id, classId: w.cls.id, sectionId: w.sectionA.id, subjectId: w.math.id, teacherId: w.teacher.id });
    expect(r.status).toBe(201);
    expect(r.body.assignment.teacherName).toBe(w.teacherUser.name);

    const dup = await admin.post("/academics/class-assignments", { shiftId: w.shift.id, classId: w.cls.id, sectionId: w.sectionA.id, subjectId: w.math.id, teacherId: w.teacher2.id });
    expect(dup.status).toBe(409);
  });
  it("a teacher cannot see another teacher's private roster fields beyond what's needed", async () => {
    const admin = await loginAs(w.admin.email);
    await admin.post("/academics/class-assignments", { shiftId: w.shift.id, classId: w.cls.id, sectionId: w.sectionA.id, subjectId: w.math.id, teacherId: w.teacher.id });
    const teacher = await loginAs(w.teacherUser.email);
    const roster = await teacher.get(`/academics/sections/${w.sectionA.id}/roster`);
    expect(roster.status).toBe(200);
    expect(JSON.stringify(roster.body)).not.toMatch(/passwordHash/);
    expect(roster.body.items.map((s: any) => s.name).sort()).toEqual(["Sam Student", "Sue Student"]);
  });
  it("?mine=true resolves the caller's own assignments without exposing other teachers'", async () => {
    const admin = await loginAs(w.admin.email);
    await admin.post("/academics/class-assignments", { shiftId: w.shift.id, classId: w.cls.id, sectionId: w.sectionA.id, subjectId: w.math.id, teacherId: w.teacher.id });
    await admin.post("/academics/class-assignments", { shiftId: w.shift.id, classId: w.cls.id, sectionId: w.sectionB.id, subjectId: w.english.id, teacherId: w.teacher2.id });
    const t1 = await loginAs(w.teacherUser.email);
    const mine = await t1.get("/academics/class-assignments?mine=true");
    expect(mine.body.items).toHaveLength(1);
    expect(mine.body.items[0].sectionId).toBe(w.sectionA.id);
  });
});

describe("attendance", () => {
  async function assign(admin: Client) {
    return admin.post("/academics/class-assignments", { shiftId: w.shift.id, classId: w.cls.id, sectionId: w.sectionA.id, subjectId: w.math.id, teacherId: w.teacher.id });
  }
  it("the assigned teacher submits attendance; absent students' guardians are emailed same day", async () => {
    const admin = await loginAs(w.admin.email);
    await assign(admin);
    const teacher = await loginAs(w.teacherUser.email);
    const date = "2025-01-15";
    const submit = await teacher.post("/attendance", {
      sectionId: w.sectionA.id, date,
      entries: [{ studentId: w.student.id, status: "present" }, { studentId: w.student2.id, status: "absent" }],
    });
    expect(submit.status).toBe(204);
    expect(mailbox().some((m) => m.to === w.parentUser.email && /absent/i.test(m.subject))).toBe(true);

    const list = await teacher.get(`/attendance?sectionId=${w.sectionA.id}&date=${date}`);
    expect(list.body.items.map((r: any) => [r.studentId, r.status]).sort()).toEqual(
      [[w.student.id, "present"], [w.student2.id, "absent"]].sort()
    );
  });
  it("a teacher NOT assigned to the section cannot submit attendance for it", async () => {
    const admin = await loginAs(w.admin.email);
    await assign(admin); // only w.teacher is assigned to sectionA
    const other = await loginAs(w.teacher2User.email);
    const r = await other.post("/attendance", { sectionId: w.sectionA.id, date: "2025-01-15", entries: [{ studentId: w.student.id, status: "present" }] });
    expect(r.status).toBe(403);
  });
  it("admin can override the attendance taker for a section", async () => {
    const admin = await loginAs(w.admin.email);
    await assign(admin); // default taker via ClassAssignment would be w.teacher
    const setTaker = await admin.post("/attendance/taker", { sectionId: w.sectionA.id, teacherId: w.teacher2.id });
    expect(setTaker.status).toBe(204);
    // now teacher2 (the delegate) can submit, teacher (the class-assignment teacher) cannot
    const delegate = await loginAs(w.teacher2User.email);
    expect((await delegate.post("/attendance", { sectionId: w.sectionA.id, date: "2025-01-16", entries: [{ studentId: w.student.id, status: "present" }] })).status).toBe(204);
    const original = await loginAs(w.teacherUser.email);
    expect((await original.post("/attendance", { sectionId: w.sectionA.id, date: "2025-01-16", entries: [{ studentId: w.student.id, status: "present" }] })).status).toBe(403);
  });
  it("resubmitting the same section+date updates rather than duplicates records", async () => {
    const admin = await loginAs(w.admin.email);
    await assign(admin);
    const teacher = await loginAs(w.teacherUser.email);
    const date = "2025-02-01";
    await teacher.post("/attendance", { sectionId: w.sectionA.id, date, entries: [{ studentId: w.student.id, status: "present" }] });
    await teacher.post("/attendance", { sectionId: w.sectionA.id, date, entries: [{ studentId: w.student.id, status: "late" }] });
    const rows = db().__rows("Attendance").filter((r: any) => r.studentId === w.student.id && r.date.toISOString().slice(0, 10) === date);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("late");
  });
  it("a student/parent cannot submit or list attendance", async () => {
    const admin = await loginAs(w.admin.email);
    await assign(admin);
    for (const email of [w.studentUser.email, w.parentUser.email]) {
      const c = await loginAs(email);
      expect((await c.post("/attendance", { sectionId: w.sectionA.id, date: "2025-01-15", entries: [{ studentId: w.student.id, status: "present" }] })).status).toBe(403);
      expect((await c.get(`/attendance?sectionId=${w.sectionA.id}&date=2025-01-15`)).status).toBe(403);
    }
  });
});
