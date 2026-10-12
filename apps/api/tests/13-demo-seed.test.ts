import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { Client, startServer, stopServer, db } from "./helpers/harness";
import { runDemoSeed, DEMO_PASSWORD } from "../prisma/seed-demo";

async function loginAs(email: string) {
  const c = new Client();
  const res = await c.login(email, DEMO_PASSWORD);
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status}`);
  return c;
}

beforeAll(async () => {
  await startServer(); // creates the in-memory DB
  db().__reset();
  await runDemoSeed(db() as any, () => {});
});
afterAll(stopServer);

describe("demo seed", () => {
  it("is idempotent: a second run changes no row counts", async () => {
    const tables = ["User", "Student", "Invoice", "Payment", "Attendance", "Mark", "Exam", "RoutineSlot", "ClassAssignment", "Resource", "Page", "Book", "BookIssue", "GalleryImage", "AdmissionApplication", "ContactMessage", "SiteSetting"];
    const before = tables.map((t) => db().__rows(t).length);
    await runDemoSeed(db() as any, () => {});
    expect(tables.map((t) => db().__rows(t).length)).toEqual(before);
    expect(before.every((n) => n > 0)).toBe(true);
  });

  it("every role can log in with the shared demo password", async () => {
    for (const email of ["superadmin1", "admin1", "admin2", "coordinator1", "accountant1", "accountant2", "librarian1", "teacher1", "teacher5", "parent1", "student1", "student8"]) {
      const c = await loginAs(`${email}@demo.school`);
      expect((await c.get("/auth/me")).body.user.email).toBe(`${email}@demo.school`);
    }
    expect(DEMO_PASSWORD).toBe("Qwer4321");
  });

  it("the generated routine has no teacher, section or room double-booking and one subject per section period", () => {
    const slots = db().__rows("RoutineSlot");
    const assignments = new Map(db().__rows("ClassAssignment").map((a: any) => [a.id, a]));
    const sections = new Map(db().__rows("Section").map((s: any) => [s.id, s]));
    const teacherSeen = new Set<string>(), sectionSeen = new Set<string>(), roomSeen = new Set<string>();
    for (const s of slots) {
      const a: any = assignments.get(s.assignmentId);
      const t = `${a.teacherId}|${s.dayOfWeek}|${s.periodId}`;
      const c = `${a.sectionId}|${s.dayOfWeek}|${s.periodId}`;
      const r = `${sections.get(a.sectionId).roomId}|${s.dayOfWeek}|${s.periodId}`;
      expect(teacherSeen.has(t)).toBe(false); teacherSeen.add(t);
      expect(sectionSeen.has(c)).toBe(false); sectionSeen.add(c);
      expect(roomSeen.has(r)).toBe(false); roomSeen.add(r);
    }
    expect(slots).toHaveLength(4 * 5 * 5); // 4 sections x 5 subjects x 5 days
  });

  it("exactly one first teacher per section, and that teacher can take attendance", async () => {
    const flagged = db().__rows("ClassAssignment").filter((a: any) => a.takesAttendance);
    expect(flagged).toHaveLength(4);
    const t1 = await loginAs("teacher1@demo.school");
    expect((await t1.get("/attendance/my-sections")).body.items).toHaveLength(4);
    const t2 = await loginAs("teacher2@demo.school");
    expect((await t2.get("/attendance/my-sections")).body.items).toEqual([]);
  });

  it("student and parent see routine, results, and invoices from the seed", async () => {
    const student = await loginAs("student1@demo.school");
    const routine = await student.get("/academics/routine");
    expect(routine.body.entries.length).toBe(25);
    expect(new Set(routine.body.entries.map((e: any) => e.sectionName))).toEqual(new Set(["A"]));

    const parent = await loginAs("parent1@demo.school"); // two children in different sections
    expect((await parent.get("/academics/routine")).body.entries.length).toBe(50);
    const invoices = await parent.get("/fees/invoices");
    expect(invoices.status).toBe(200);
    expect(invoices.body.items.length).toBeGreaterThanOrEqual(8);
  });

  it("includes a mix of paid / partial / overdue invoices, an overdue library loan, and published CMS pages", async () => {
    const statuses = new Set(db().__rows("Invoice").map((i: any) => i.status));
    for (const s of ["paid", "partial", "overdue"]) expect(statuses.has(s)).toBe(true);
    const overdueLoan = db().__rows("BookIssue").find((b: any) => !b.returnedAt && new Date(b.dueAt) < new Date());
    expect(overdueLoan).toBeTruthy();

    const anon = await new Client().get("/public/pages/about");
    expect(anon.status).toBe(200);
    expect(anon.body.page.title).toBe("About Our School");
    const draft = await new Client().get("/public/pages/privacy-policy");
    expect(draft.status).toBe(404);
  });

  it("seeds a populated public website, fee kinds and student codes", async () => {
    const c = new Client();
    const site = (await c.get("/public/site")).body;
    expect(site.teachers.length).toBe(4);
    expect(site.gallery.length).toBe(4);
    expect(site.classes.length).toBe(3);
    expect(site.home.heroTitle).toContain("known by name");
    expect(db().__rows("FeeStructure").filter((f: any) => f.kind === "monthly")).toHaveLength(3);
    expect(db().__rows("FeeStructure").filter((f: any) => f.kind === "admission")).toHaveLength(3);
    const codes = db().__rows("Student").map((s: any) => s.studentCode);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every((x: string) => /^\d{4}-\d{4}$/.test(x))).toBe(true);
    const admin = await loginAs("admin1@demo.school");
    expect((await admin.get("/site/applications?status=new")).body.items).toHaveLength(1);
  });

  it("monthly generation works on the seeded data and is safe to repeat", async () => {
    const acc = await loginAs("accountant1@demo.school");
    const body = { feeStructureId: "default-fee-tuition-6", term: "2099-01", dueDate: "2099-01-10" };
    const first = await acc.post("/fees/invoices/generate", body);
    expect(first.status).toBe(201);
    expect(first.body.created).toBeGreaterThan(0);
    const again = await acc.post("/fees/invoices/generate", body);
    expect(again.body.created).toBe(0);
    expect(again.body.skipped).toBe(first.body.created);
  });
});
