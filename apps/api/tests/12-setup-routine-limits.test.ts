import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { Client, startServer, stopServer, seedSchool, loginAs, db, type World } from "./helpers/harness";

let w: World;
beforeAll(startServer);
afterAll(stopServer);
beforeEach(async () => { w = await seedSchool(); });

async function makePeriods(admin: Client) {
  const p1 = (await admin.post("/setup/periods", { name: "Period 1", shiftId: w.shift.id, startTime: "08:00", endTime: "08:45" })).body.period;
  const p2 = (await admin.post("/setup/periods", { name: "Period 2", shiftId: w.shift.id, startTime: "08:45", endTime: "09:30" })).body.period;
  const brk = (await admin.post("/setup/periods", { name: "Break", shiftId: w.shift.id, startTime: "09:30", endTime: "09:50", isBreak: true })).body.period;
  return { p1, p2, brk };
}
const base = () => ({ sectionId: w.sectionA.id, subjectId: w.math.id, teacherId: w.teacher.id });

describe("academic setup CRUD", () => {
  it("admin creates a class, section, building and room; room works without a building", async () => {
    const admin = await loginAs(w.admin.email);
    const cls = await admin.post("/setup/classes", { name: "Class 7", shiftId: w.shift.id });
    expect(cls.status).toBe(201);
    expect(cls.body.class.shiftName).toBe("Morning");

    const sec = await admin.post("/setup/sections", { name: "A", classId: cls.body.class.id });
    expect(sec.status).toBe(201);
    expect(sec.body.section.className).toBe("Class 7");

    const noBuilding = await admin.post("/setup/rooms", { name: "Lab", capacity: 30 });
    expect(noBuilding.status).toBe(201);
    expect(noBuilding.body.room.buildingId).toBeNull();

    const b = await admin.post("/setup/buildings", { name: "Science Block" });
    expect(b.status).toBe(201);
    expect(db().__rows("Campus")).toHaveLength(1); // the seeded campus is reused, none invented
    const withBuilding = await admin.post("/setup/rooms", { name: "201", buildingId: b.body.building.id });
    expect(withBuilding.body.room.buildingName).toBe("Science Block");
  });

  it("rejects duplicates and refuses to delete things that are still in use", async () => {
    const admin = await loginAs(w.admin.email);
    expect((await admin.post("/setup/classes", { name: "Class 6", shiftId: w.shift.id })).status).toBe(409);
    expect((await admin.post("/setup/sections", { name: "A", classId: w.cls.id })).status).toBe(409);
    expect((await admin.del(`/setup/classes/${w.cls.id}`)).status).toBe(409); // has sections
    expect((await admin.del(`/setup/rooms/${w.room.id}`)).status).toBe(409); // sectionA uses it
    expect((await admin.del(`/setup/sections/${w.sectionA.id}`)).status).toBe(409); // has students
  });

  it("only admin-tier roles can use setup endpoints", async () => {
    for (const email of [w.teacherUser.email, w.studentUser.email, w.parentUser.email, w.accountant.email]) {
      const c = await loginAs(email);
      expect((await c.get("/setup/classes")).status).toBe(403);
      expect((await c.post("/setup/classes", { name: "X", shiftId: w.shift.id })).status).toBe(403);
    }
  });

  it("validates period times and overlap", async () => {
    const admin = await loginAs(w.admin.email);
    await makePeriods(admin);
    expect((await admin.post("/setup/periods", { name: "Bad", shiftId: w.shift.id, startTime: "9:00", endTime: "10:00" })).status).toBe(400);
    expect((await admin.post("/setup/periods", { name: "Back", shiftId: w.shift.id, startTime: "10:00", endTime: "09:00" })).status).toBe(400);
    expect((await admin.post("/setup/periods", { name: "Overlap", shiftId: w.shift.id, startTime: "08:30", endTime: "09:00" })).status).toBe(409);
  });

  it("only one academic year can be current", async () => {
    const admin = await loginAs(w.admin.email);
    const a = await admin.post("/setup/academic-years", { name: "2025", startDate: "2025-01-01", endDate: "2025-12-31", isCurrent: true });
    const b = await admin.post("/setup/academic-years", { name: "2026", startDate: "2026-01-01", endDate: "2026-12-31", isCurrent: true });
    expect(a.status).toBe(201);
    const list = (await admin.get("/setup/academic-years")).body.items;
    expect(list.filter((y: any) => y.isCurrent).map((y: any) => y.name)).toEqual(["2026"]);
    expect((await admin.del(`/setup/academic-years/${b.body.year.id}`)).status).toBe(409);
  });
});

describe("assignment + routine", () => {
  it("creating an assignment with slots builds the routine; classId/shiftId are derived", async () => {
    const admin = await loginAs(w.admin.email);
    const { p1, p2 } = await makePeriods(admin);
    const r = await admin.post("/academics/class-assignments", {
      ...base(),
      slots: [{ dayOfWeek: "sun", periodId: p1.id }, { dayOfWeek: "tue", periodId: p2.id }],
    });
    expect(r.status).toBe(201);
    expect(r.body.assignment.classId).toBe(w.cls.id);
    expect(r.body.assignment.shiftId).toBe(w.shift.id);
    expect(r.body.assignment.slots).toHaveLength(2);

    const routine = await admin.get(`/academics/routine?sectionId=${w.sectionA.id}`);
    expect(routine.body.entries.map((e: any) => [e.dayOfWeek, e.subjectName, e.teacherName, e.roomName]).sort()).toEqual(
      [["sun", "Mathematics", w.teacherUser.name, "101"], ["tue", "Mathematics", w.teacherUser.name, "101"]].sort()
    );
    expect(routine.body.periods.map((p: any) => p.name)).toEqual(["Period 1", "Period 2", "Break"]);
  });

  it("blocks teacher, section and room double-booking with a 409 that names the clash", async () => {
    const admin = await loginAs(w.admin.email);
    const { p1 } = await makePeriods(admin);
    expect((await admin.post("/academics/class-assignments", { ...base(), slots: [{ dayOfWeek: "sun", periodId: p1.id }] })).status).toBe(201);

    // same teacher, different section, same slot
    const teacherClash = await admin.post("/academics/class-assignments", {
      sectionId: w.sectionB.id, subjectId: w.english.id, teacherId: w.teacher.id, slots: [{ dayOfWeek: "sun", periodId: p1.id }],
    });
    expect(teacherClash.status).toBe(409);
    expect(teacherClash.body.code).toBe("ROUTINE_CLASH");
    expect(teacherClash.body.message).toMatch(/already teaches Mathematics/);

    // same section, different teacher, same slot
    const sectionClash = await admin.post("/academics/class-assignments", {
      sectionId: w.sectionA.id, subjectId: w.english.id, teacherId: w.teacher2.id, slots: [{ dayOfWeek: "sun", periodId: p1.id }],
    });
    expect(sectionClash.status).toBe(409);
    expect(sectionClash.body.message).toMatch(/section A already has Mathematics/);

    // a different slot is fine
    const p2 = (await admin.get("/setup/periods")).body.items.find((p: any) => p.name === "Period 2");
    const ok = await admin.post("/academics/class-assignments", {
      sectionId: w.sectionA.id, subjectId: w.english.id, teacherId: w.teacher2.id, slots: [{ dayOfWeek: "sun", periodId: p2.id }],
    });
    expect(ok.status).toBe(201);
  });

  it("rejects break periods, periods of another shift and duplicate slots", async () => {
    const admin = await loginAs(w.admin.email);
    const { p1, brk } = await makePeriods(admin);
    const otherShift = (await admin.post("/setup/shifts", { name: "Day" })).body.shift;
    const foreign = (await admin.post("/setup/periods", { name: "D1", shiftId: otherShift.id, startTime: "13:00", endTime: "13:45" })).body.period;

    expect((await admin.post("/academics/class-assignments", { ...base(), slots: [{ dayOfWeek: "mon", periodId: brk.id }] })).body.code).toBe("PERIOD_IS_BREAK");
    expect((await admin.post("/academics/class-assignments", { ...base(), slots: [{ dayOfWeek: "mon", periodId: foreign.id }] })).body.code).toBe("PERIOD_WRONG_SHIFT");
    expect((await admin.post("/academics/class-assignments", { ...base(), slots: [{ dayOfWeek: "mon", periodId: p1.id }, { dayOfWeek: "mon", periodId: p1.id }] })).body.code).toBe("DUPLICATE_SLOT");
  });

  it("rejects mismatched references (subject from another class, bad teacher)", async () => {
    const admin = await loginAs(w.admin.email);
    const cls7 = (await admin.post("/setup/classes", { name: "Class 7", shiftId: w.shift.id })).body.class;
    const sub7 = (await admin.post("/academics/subjects", { name: "Science", classId: cls7.id })).body.subject;
    expect((await admin.post("/academics/class-assignments", { ...base(), subjectId: sub7.id })).body.code).toBe("SUBJECT_CLASS_MISMATCH");
    expect((await admin.post("/academics/class-assignments", { ...base(), teacherId: "nope" })).body.code).toBe("TEACHER_NOT_FOUND");
    expect((await admin.post("/academics/class-assignments", { ...base(), classId: cls7.id })).body.code).toBe("SECTION_CLASS_MISMATCH");
  });

  it("PATCH replaces slots, re-checks clashes when the teacher changes, and delete removes slots", async () => {
    const admin = await loginAs(w.admin.email);
    const { p1, p2 } = await makePeriods(admin);
    const a1 = (await admin.post("/academics/class-assignments", { ...base(), slots: [{ dayOfWeek: "sun", periodId: p1.id }] })).body.assignment;
    const a2 = (await admin.post("/academics/class-assignments", {
      sectionId: w.sectionB.id, subjectId: w.english.id, teacherId: w.teacher2.id, slots: [{ dayOfWeek: "sun", periodId: p1.id }],
    })).body.assignment;

    // moving a1 to p2 works and replaces (not appends)
    const moved = await admin.patch(`/academics/class-assignments/${a1.id}`, { slots: [{ dayOfWeek: "mon", periodId: p2.id }] });
    expect(moved.status).toBe(200);
    expect(moved.body.assignment.slots.map((s: any) => [s.dayOfWeek, s.periodId])).toEqual([["mon", p2.id]]);

    // handing a2 to teacher 1 clashes with a1? a1 is now mon/p2, so no clash
    expect((await admin.patch(`/academics/class-assignments/${a2.id}`, { teacherId: w.teacher.id })).status).toBe(200);
    // ...but moving a1 back onto sun/p1 now clashes with a2 (teacher 1 teaches it)
    expect((await admin.patch(`/academics/class-assignments/${a1.id}`, { slots: [{ dayOfWeek: "sun", periodId: p1.id }] })).status).toBe(409);

    expect((await admin.del(`/academics/class-assignments/${a2.id}`)).status).toBe(204);
    expect(db().__rows("RoutineSlot").filter((s: any) => s.assignmentId === a2.id)).toHaveLength(0);
  });

  it("student and parent see only their own section's routine; teacher sees own periods", async () => {
    const admin = await loginAs(w.admin.email);
    const { p1, p2 } = await makePeriods(admin);
    await admin.post("/academics/class-assignments", { ...base(), slots: [{ dayOfWeek: "sun", periodId: p1.id }] });
    await admin.post("/academics/class-assignments", {
      sectionId: w.sectionB.id, subjectId: w.english.id, teacherId: w.teacher2.id, slots: [{ dayOfWeek: "sun", periodId: p2.id }],
    });

    const student = await loginAs(w.studentUser.email);
    const mine = await student.get("/academics/routine");
    expect(mine.body.entries.map((e: any) => e.sectionName)).toEqual(["A"]);
    expect((await student.get(`/academics/routine?sectionId=${w.sectionB.id}`)).status).toBe(403);

    const parent = await loginAs(w.parentUser.email);
    expect((await parent.get("/academics/routine")).body.entries).toHaveLength(1);
    const otherParent = await loginAs(w.otherParentUser.email);
    expect((await otherParent.get("/academics/routine")).body.entries.map((e: any) => e.subjectName)).toEqual(["English"]);

    const t1 = await loginAs(w.teacherUser.email);
    expect((await t1.get("/academics/routine?mine=true")).body.entries.map((e: any) => e.subjectName)).toEqual(["Mathematics"]);
  });
});

describe("first teacher takes attendance", () => {
  it("the flagged teacher can take attendance even if another was assigned first; flag is exclusive per section", async () => {
    const admin = await loginAs(w.admin.email);
    const first = (await admin.post("/academics/class-assignments", base())).body.assignment; // teacher 1, assigned first, unflagged
    const second = (await admin.post("/academics/class-assignments", {
      sectionId: w.sectionA.id, subjectId: w.english.id, teacherId: w.teacher2.id, takesAttendance: true,
    })).body.assignment;
    expect(second.takesAttendance).toBe(true);

    const entries = [{ studentId: w.student.id, status: "present" }];
    const t1 = await loginAs(w.teacherUser.email);
    const t2 = await loginAs(w.teacher2User.email);
    expect((await t1.post("/attendance", { sectionId: w.sectionA.id, date: "2025-02-01", entries })).status).toBe(403);
    expect((await t2.post("/attendance", { sectionId: w.sectionA.id, date: "2025-02-01", entries })).status).toBe(204);

    // flagging the first one moves the flag instead of creating two takers
    await admin.patch(`/academics/class-assignments/${first.id}`, { takesAttendance: true });
    const rows = db().__rows("ClassAssignment").filter((a: any) => a.sectionId === w.sectionA.id);
    expect(rows.filter((a: any) => a.takesAttendance)).toHaveLength(1);
    expect((await t1.post("/attendance", { sectionId: w.sectionA.id, date: "2025-02-02", entries })).status).toBe(204);
  });

  it("a teacher's attendance list only includes sections they may submit for", async () => {
    const admin = await loginAs(w.admin.email);
    await admin.post("/academics/class-assignments", base()); // teacher 1: unflagged, first
    await admin.post("/academics/class-assignments", { sectionId: w.sectionA.id, subjectId: w.english.id, teacherId: w.teacher2.id, takesAttendance: true });
    const t1 = await loginAs(w.teacherUser.email);
    const t2 = await loginAs(w.teacher2User.email);
    expect((await t1.get("/attendance/my-sections")).body.items).toEqual([]);
    expect((await t2.get("/attendance/my-sections")).body.items).toMatchObject([{ id: w.sectionA.id, label: "Class 6 — A", takenToday: false }]);
    expect((await admin.get("/attendance/my-sections")).status).toBe(403);
  });

  it("the admin's explicit override still wins over the flag", async () => {
    const admin = await loginAs(w.admin.email);
    await admin.post("/academics/class-assignments", { ...base(), takesAttendance: true });
    await admin.post("/attendance/taker", { sectionId: w.sectionA.id, teacherId: w.teacher2.id });
    const t1 = await loginAs(w.teacherUser.email);
    expect((await t1.post("/attendance", { sectionId: w.sectionA.id, date: "2025-02-03", entries: [{ studentId: w.student.id, status: "present" }] })).status).toBe(403);
  });
});

describe("role account limits (Super Admin)", () => {
  const newTeacher = (n: number) => ({ name: `New Teacher ${n}`, email: `nt${n}@test.school`, role: "teacher", password: "Passw0rd!" });

  it("blocks creating accounts past the cap, counts only active users, and unlimited again when cleared", async () => {
    const sa = await loginAs(w.superAdmin.email);
    const admin = await loginAs(w.admin.email);
    expect((await admin.post("/users", newTeacher(1))).status).toBe(201); // no cap yet

    // 3 active teachers now exist; cap at 3 -> next one refused
    const set = await sa.post("/role-limits", { role: "teacher", maxAccounts: 3 });
    expect(set.status).toBe(200);
    expect(set.body.items.find((r: any) => r.role === "teacher")).toMatchObject({ maxAccounts: 3, activeAccounts: 3 });
    const blocked = await admin.post("/users", newTeacher(2));
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe("ROLE_LIMIT_REACHED");

    // disabling a teacher frees a seat
    await db().user.update({ where: { id: w.teacher2.userId }, data: { isActive: false } });
    expect((await admin.post("/users", newTeacher(3))).status).toBe(201);

    // other roles are unaffected; clearing the cap removes the limit
    expect((await admin.post("/users", { ...newTeacher(4), role: "accountant" })).status).toBe(201);
    await sa.post("/role-limits", { role: "teacher", maxAccounts: null });
    expect((await admin.post("/users", newTeacher(5))).status).toBe(201);
  });

  it("applies to public self-registration too", async () => {
    const sa = await loginAs(w.superAdmin.email);
    await sa.post("/role-limits", { role: "student", maxAccounts: 3 }); // seed already has 3 students
    const anon = new Client();
    const r = await anon.raw("POST", "/auth/register", { body: { name: "Late Student", email: "late@test.school", password: "Passw0rd!", role: "student" }, csrf: false });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe("ROLE_LIMIT_REACHED");
  });

  it("only a Super Admin can read or change limits; invalid values are rejected", async () => {
    const admin = await loginAs(w.admin.email);
    expect((await admin.get("/role-limits")).status).toBe(403);
    expect((await admin.post("/role-limits", { role: "teacher", maxAccounts: 1 })).status).toBe(403);
    const sa = await loginAs(w.superAdmin.email);
    expect((await sa.post("/role-limits", { role: "teacher", maxAccounts: 0 })).status).toBe(400);
    expect((await sa.post("/role-limits", { role: "wizard", maxAccounts: 5 })).status).toBe(400);
  });
});

describe("lookup (searchable dropdown data)", () => {
  it("admin searches teachers by partial, case-insensitive name", async () => {
    const admin = await loginAs(w.admin.email);
    const r = await admin.get("/lookup/teachers?q=TIN");
    expect(r.body.items).toEqual([{ value: w.teacher.id, label: "Tina Teacher", hint: w.teacherUser.email }]);
    expect((await admin.get("/lookup/teachers")).body.items).toHaveLength(2);
    expect((await admin.get("/lookup/teachers?q=zzz")).body.items).toEqual([]);
  });

  it("filters sections by class and honors the limit", async () => {
    const admin = await loginAs(w.admin.email);
    const r = await admin.get(`/lookup/sections?classId=${w.cls.id}&limit=1`);
    expect(r.body.items).toHaveLength(1);
    expect(r.body.items[0].label).toBe("Class 6 — A");
  });

  it("a teacher only gets their own sections/subjects/students and cannot list teachers or rooms", async () => {
    const admin = await loginAs(w.admin.email);
    await admin.post("/academics/class-assignments", base());
    const t = await loginAs(w.teacherUser.email);
    expect((await t.get("/lookup/sections")).body.items.map((i: any) => i.value)).toEqual([w.sectionA.id]);
    expect((await t.get("/lookup/subjects")).body.items.map((i: any) => i.label)).toEqual(["Mathematics"]);
    expect((await t.get("/lookup/students")).body.items.map((i: any) => i.label).sort()).toEqual(["Sam Student", "Sue Student"]);
    expect((await t.get(`/lookup/students?sectionId=${w.sectionB.id}`)).body.items).toEqual([]);
    expect((await t.get("/lookup/teachers")).status).toBe(403);
    expect((await t.get("/lookup/rooms")).status).toBe(403);
  });

  it("students and parents get nothing; unknown kinds are rejected", async () => {
    const s = await loginAs(w.studentUser.email);
    expect((await s.get("/lookup/students")).status).toBe(403);
    expect((await (await loginAs(w.parentUser.email)).get("/lookup/sections")).status).toBe(403);
    const admin = await loginAs(w.admin.email);
    expect((await admin.get("/lookup/passwords")).status).toBe(400);
    expect((await new Client().get("/lookup/teachers")).status).toBe(401);
  });
});
