import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { Client, startServer, stopServer, seedSchool, loginAs, db, mailbox, type World } from "./helpers/harness";

let w: World;
beforeAll(startServer);
afterAll(stopServer);
beforeEach(async () => { w = await seedSchool(); });

const year = new Date().getFullYear();
const term = new Date().toISOString().slice(0, 7);

async function feeSetup() {
  const admission = await db().feeStructure.create({ data: { name: "Admission Fee", classId: w.cls.id, shiftId: w.shift.id, year, amount: 500000, kind: "admission" } });
  const tuition = await db().feeStructure.create({ data: { name: "Monthly Tuition", classId: w.cls.id, shiftId: w.shift.id, year, amount: 250000, kind: "monthly" } });
  return { admission, tuition };
}
const newGuardian = { name: "Gina Guardian", email: "gina@test.school", phone: "01712345678" };
const base = () => ({ name: "New Kid", email: "newkid@test.school", sectionId: w.sectionB.id, guardian: newGuardian });

describe("admission", () => {
  it("creates account, guardian, roll number, student code and the default invoices atomically", async () => {
    const { admission, tuition } = await feeSetup();
    const admin = await loginAs(w.admin.email);
    const r = await admin.post("/students/admit", base());
    expect(r.status).toBe(201);
    expect(r.body.guardianCreated).toBe(true);
    expect(r.body.student.rollNumber).toBe("02"); // sectionB already has roll 01
    expect(r.body.student.studentCode).toBe(`${year}-0001`);
    expect(r.body.student.sectionLabel).toBe("Class 6 — B");
    expect(r.body.student.guardianName).toBe("Gina Guardian");
    const feeIds = r.body.invoices.map((i: any) => i.feeName).sort();
    expect(feeIds).toEqual(["Admission Fee", "Monthly Tuition"]);
    expect(r.body.invoices.find((i: any) => i.feeName === "Monthly Tuition").term).toBe(term);
    expect(db().__rows("Invoice").filter((i: any) => i.feeStructureId === admission.id || i.feeStructureId === tuition.id)).toHaveLength(2);
    expect(mailbox().some((m) => m.to === "gina@test.school" && /admitted/.test(m.subject))).toBe(true);

    // second admission continues the sequences and reuses the same guardian by id
    const second = await admin.post("/students/admit", { ...base(), name: "Sib Kid", email: "sib@test.school", guardian: { guardianId: r.body.student.guardianId } });
    expect(second.body.student.rollNumber).toBe("03");
    expect(second.body.student.studentCode).toBe(`${year}-0002`);
    expect(second.body.guardianCreated).toBe(false);
  });

  it("a returning guardian email is reused, not duplicated", async () => {
    const admin = await loginAs(w.admin.email);
    await admin.post("/students/admit", base());
    const again = await admin.post("/students/admit", { ...base(), name: "Sib", email: "sib2@test.school" });
    expect(again.status).toBe(201);
    expect(again.body.guardianCreated).toBe(false);
    expect(db().__rows("Guardian").filter((g: any) => g.phone === "01712345678")).toHaveLength(1);
  });

  it("reports an unknown application id as a clean 400 (the real DB rolls the whole admission back)", async () => {
    const admin = await loginAs(w.admin.email);
    const r = await admin.post("/students/admit", { ...base(), applicationId: "nope" });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe("APPLICATION_NOT_FOUND");
  });

  it("validates input, duplicates, and fee/class mismatches", async () => {
    const admin = await loginAs(w.admin.email);
    expect((await admin.post("/students/admit", { ...base(), email: "bad" })).status).toBe(400);
    expect((await admin.post("/students/admit", { ...base(), sectionId: "" })).status).toBe(400);
    expect((await admin.post("/students/admit", { ...base(), email: w.studentUser.email })).status).toBe(409);
    expect((await admin.post("/students/admit", { ...base(), sectionId: "nope" })).body.code).toBe("SECTION_NOT_FOUND");
    expect((await admin.post("/students/admit", { ...base(), guardian: { guardianId: "nope" } })).body.code).toBe("GUARDIAN_NOT_FOUND");
    expect((await admin.post("/students/admit", { ...base(), guardian: { ...newGuardian, email: "newkid@test.school" } })).body.code).toBe("EMAIL_CLASH");
    const cls2 = await db().class.create({ data: { name: "Class 9", schoolId: w.school.id, shiftId: w.shift.id } });
    const other = await db().feeStructure.create({ data: { name: "Other", classId: cls2.id, shiftId: w.shift.id, year, amount: 1, kind: "other" } });
    expect((await admin.post("/students/admit", { ...base(), feeStructureIds: [other.id] })).body.code).toBe("FEE_CLASS_MISMATCH");
  });

  it("enforces the student account limit and admin-tier access", async () => {
    const sa = await loginAs(w.superAdmin.email);
    await sa.post("/role-limits", { role: "student", maxAccounts: 3 }); // seed already has 3
    const admin = await loginAs(w.admin.email);
    const r = await admin.post("/students/admit", base());
    expect(r.status).toBe(409);
    expect(r.body.code).toBe("ROLE_LIMIT_REACHED");
    for (const email of [w.teacherUser.email, w.accountant.email, w.parentUser.email]) {
      expect((await (await loginAs(email)).post("/students/admit", base())).status).toBe(403);
    }
  });

  it("lists, searches, moves (new roll number), and deactivates students", async () => {
    const admin = await loginAs(w.admin.email);
    const list = await admin.get("/students?q=sam");
    expect(list.body.items.map((s: any) => s.name)).toEqual(["Sam Student"]);
    const all = await admin.get(`/students?sectionId=${w.sectionA.id}`);
    expect(all.body.total).toBe(2);

    const moved = await admin.patch(`/students/${w.student.id}`, { sectionId: w.sectionB.id });
    expect(moved.body.student.sectionLabel).toBe("Class 6 — B");
    expect(moved.body.student.rollNumber).toBe("02");
    expect((await admin.patch(`/students/${w.student2.id}`, { rollNumber: "01" })).body.student.rollNumber).toBe("01"); // free in A now

    const off = await admin.patch(`/students/${w.student2.id}`, { isActive: false });
    expect(off.body.student.isActive).toBe(false);
    expect((await new Client().login(w.student2User.email)).status).toBe(400);
  });

  it("converts a public application into a student exactly once", async () => {
    const app = await db().admissionApplication.create({ data: { studentName: "App Kid", guardianName: "G", guardianPhone: "01700000000", guardianEmail: "g@x.com", appliedClassId: w.cls.id } });
    const admin = await loginAs(w.admin.email);
    const r = await admin.post("/students/admit", { ...base(), applicationId: app.id });
    expect(r.status).toBe(201);
    expect(db().__rows("AdmissionApplication")[0]).toMatchObject({ status: "approved", studentId: r.body.student.id });
    const again = await admin.post("/students/admit", { ...base(), email: "x2@test.school", guardian: { ...newGuardian, email: "g2@test.school" }, applicationId: app.id });
    expect(again.status).toBe(409);
  });
});

describe("monthly fee generation", () => {
  it("covers all sections of the class and is idempotent", async () => {
    const { tuition } = await feeSetup();
    const acc = await loginAs(w.accountant.email);
    const body = { feeStructureId: tuition.id, term: "2026-12", dueDate: "2026-12-10" };
    const r1 = await acc.post("/fees/invoices/generate", body);
    expect(r1.body.created + r1.body.skipped).toBe(3);
    const r2 = await acc.post("/fees/invoices/generate", body);
    expect(r2.body).toEqual({ created: 0, skipped: 3 });
    expect(db().__rows("Invoice").filter((i: any) => i.term === "2026-12")).toHaveLength(3);
    // one fee reminder per guardian, not per child (parent has 2 children)
    expect(mailbox().filter((m) => m.to === w.parentUser.email && /Monthly Tuition/.test(m.subject))).toHaveLength(1);
  });

  it("section filter, inactive students skipped, finance-only access", async () => {
    const { tuition } = await feeSetup();
    await db().user.update({ where: { id: w.student2User.id }, data: { isActive: false } });
    const acc = await loginAs(w.accountant.email);
    const r = await acc.post("/fees/invoices/generate", { feeStructureId: tuition.id, term: "2027-01", dueDate: "2027-01-10", sectionId: w.sectionA.id });
    expect(r.body).toEqual({ created: 1, skipped: 0 });
    expect((await (await loginAs(w.teacherUser.email)).post("/fees/invoices/generate", { feeStructureId: tuition.id, term: "x", dueDate: "2027-01-10" })).status).toBe(403);
    expect((await acc.post("/fees/invoices/generate", { feeStructureId: "nope", term: "x", dueDate: "2027-01-10" })).body.code).toBe("FEE_STRUCTURE_NOT_FOUND");
  });

  it("fee structures support kind, update and soft delete", async () => {
    const acc = await loginAs(w.accountant.email);
    const created = await acc.post("/fees/structures", { name: "Exam Fee", classId: w.cls.id, shiftId: w.shift.id, year, amount: 100000, kind: "other" });
    expect(created.body.feeStructure.kind).toBe("other");
    const id = created.body.feeStructure.id;
    expect((await acc.patch(`/fees/structures/${id}`, { amount: 120000, kind: "monthly" })).body.feeStructure).toMatchObject({ amount: 120000, kind: "monthly" });
    expect((await acc.del(`/fees/structures/${id}`)).status).toBe(204);
    expect((await acc.get("/fees/structures")).body.items.find((f: any) => f.id === id)).toBeUndefined();
  });
});

describe("online payment (sandbox)", () => {
  async function invoiceFor(studentId: string, amount = 250000) {
    const { tuition } = await feeSetup();
    return db().invoice.create({ data: { studentId, feeStructureId: tuition.id, term, amountDue: amount, dueDate: new Date(Date.now() + 864e5) } });
  }

  it("disabled without sandbox/gateway config; options reflect that", async () => {
    const parent = await loginAs(w.parentUser.email);
    const inv = await invoiceFor(w.student.id);
    expect((await parent.get("/fees/payments/options")).body).toEqual({ methods: [], sandbox: false });
    const r = await parent.post("/fees/payments/initiate", { invoiceId: inv.id, method: "bkash" });
    expect(r.body.code).toBe("PAYMENT_METHOD_DISABLED");
  });
});
