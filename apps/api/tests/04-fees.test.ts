import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { Client, startServer, stopServer, seedSchool, loginAs, db, mailbox, type World } from "./helpers/harness";

let w: World;
let feeStructureId: string;
beforeAll(startServer);
afterAll(stopServer);
beforeEach(async () => {
  w = await seedSchool();
  const accountant = await loginAs(w.accountant.email);
  const fs = await accountant.post("/fees/structures", { name: "Tuition", classId: w.cls.id, shiftId: w.shift.id, year: 2025, amount: 250000 });
  feeStructureId = fs.body.feeStructure.id;
});

describe("fee structures & invoices", () => {
  it("a past due date is immediately marked overdue (no separate cron needed for the API to report it)", async () => {
    const accountant = await loginAs(w.accountant.email);
    const r = await accountant.post("/fees/invoices", { studentId: w.student.id, feeStructureId, term: "Late", dueDate: "2020-01-01" });
    expect(r.body.invoice.status).toBe("overdue");
  });

  it("creating an invoice copies the fee structure amount and emails the guardian", async () => {
    const accountant = await loginAs(w.accountant.email);
    const r = await accountant.post("/fees/invoices", { studentId: w.student.id, feeStructureId, term: "Term 1", dueDate: "2099-03-01" });
    expect(r.status).toBe(201);
    expect(r.body.invoice.amountDue).toBe(250000);
    expect(r.body.invoice.status).toBe("unpaid");
    expect(mailbox().some((m) => m.to === w.parentUser.email && /invoice/i.test(m.subject))).toBe(true);
  });
  it("status moves unpaid -> partial -> paid as payments come in, and never accepts a negative amount", async () => {
    const accountant = await loginAs(w.accountant.email);
    const inv = (await accountant.post("/fees/invoices", { studentId: w.student.id, feeStructureId, term: "Term 1", dueDate: "2099-03-01" })).body.invoice;

    const neg = await accountant.post("/fees/payments", { invoiceId: inv.id, amount: -100, method: "cash" });
    expect(neg.status).toBe(400);

    await accountant.post("/fees/payments", { invoiceId: inv.id, amount: 100000, method: "cash" });
    let after = (await accountant.get(`/fees/invoices?studentId=${w.student.id}`)).body.items.find((i: any) => i.id === inv.id);
    expect(after.status).toBe("partial");
    expect(after.amountPaid).toBe(100000);

    await accountant.post("/fees/payments", { invoiceId: inv.id, amount: 150000, method: "bkash", transactionRef: "TX1" });
    after = (await accountant.get(`/fees/invoices?studentId=${w.student.id}`)).body.items.find((i: any) => i.id === inv.id);
    expect(after.status).toBe("paid");
    expect(after.amountPaid).toBe(250000);
  });
  it("overpaying is rejected and leaves the invoice untouched", async () => {
    const accountant = await loginAs(w.accountant.email);
    const inv = (await accountant.post("/fees/invoices", { studentId: w.student.id, feeStructureId, term: "T", dueDate: "2099-03-01" })).body.invoice;
    const r = await accountant.post("/fees/payments", { invoiceId: inv.id, amount: 999999, method: "cash" });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe("OVERPAYMENT");
    const after = (await accountant.get(`/fees/invoices?studentId=${w.student.id}`)).body.items.find((i: any) => i.id === inv.id);
    expect(after.amountPaid).toBe(0);
    expect(after.status).not.toBe("paid");
  });
  it("a fully paid invoice cannot be paid again, and zero-amount payments are rejected", async () => {
    const accountant = await loginAs(w.accountant.email);
    const inv = (await accountant.post("/fees/invoices", { studentId: w.student.id, feeStructureId, term: "T", dueDate: "2099-03-01" })).body.invoice;
    expect((await accountant.post("/fees/payments", { invoiceId: inv.id, amount: 0, method: "cash" })).status).toBe(400);
    expect((await accountant.post("/fees/payments", { invoiceId: inv.id, amount: inv.amountDue, method: "cash" })).status).toBe(201);
    expect((await accountant.post("/fees/payments", { invoiceId: inv.id, amount: 1, method: "cash" })).status).toBe(409);
  });
});

describe("fee data isolation (parents/students only see their own)", () => {
  it("a parent sees only their own children's invoices, never another family's", async () => {
    const accountant = await loginAs(w.accountant.email);
    await accountant.post("/fees/invoices", { studentId: w.student.id, feeStructureId, term: "T1", dueDate: "2099-03-01" });
    await accountant.post("/fees/invoices", { studentId: w.otherStudent.id, feeStructureId, term: "T1", dueDate: "2099-03-01" });

    const parent = await loginAs(w.parentUser.email);
    const mine = await parent.get("/fees/invoices");
    expect(mine.body.items.every((i: any) => i.studentName !== w.otherStudentUser.name)).toBe(true);
    expect(mine.body.items.some((i: any) => i.studentName === w.studentUser.name)).toBe(true);
  });
  it("a parent requesting another family's student id explicitly gets 403, not their own data instead", async () => {
    const accountant = await loginAs(w.accountant.email);
    await accountant.post("/fees/invoices", { studentId: w.otherStudent.id, feeStructureId, term: "T1", dueDate: "2099-03-01" });
    const parent = await loginAs(w.parentUser.email);
    const r = await parent.get(`/fees/invoices?studentId=${w.otherStudent.id}`);
    expect(r.status).toBe(403);
  });
  it("a student sees only their own invoice, scoped server-side even if they pass no filter", async () => {
    const accountant = await loginAs(w.accountant.email);
    await accountant.post("/fees/invoices", { studentId: w.student.id, feeStructureId, term: "T1", dueDate: "2099-03-01" });
    await accountant.post("/fees/invoices", { studentId: w.student2.id, feeStructureId, term: "T1", dueDate: "2099-03-01" });
    const student = await loginAs(w.studentUser.email);
    const r = await student.get("/fees/invoices");
    expect(r.status).toBe(200);
    expect(r.body.items.every((i: any) => i.studentName === w.studentUser.name)).toBe(true);
  });
  it("a teacher cannot create fee structures or invoices", async () => {
    const teacher = await loginAs(w.teacherUser.email);
    expect((await teacher.post("/fees/structures", { name: "x", classId: w.cls.id, shiftId: w.shift.id, year: 2025, amount: 1 })).status).toBe(403);
    expect((await teacher.post("/fees/invoices", { studentId: w.student.id, feeStructureId, term: "T", dueDate: "2099-03-01" })).status).toBe(403);
  });
});

describe("online payment gateways (env-gated stubs)", () => {
  it("initiating a payment via a disabled gateway is refused with a clear error, not a 500", async () => {
    const accountant = await loginAs(w.accountant.email);
    const inv = (await accountant.post("/fees/invoices", { studentId: w.student.id, feeStructureId, term: "T", dueDate: "2099-03-01" })).body.invoice;
    const r = await accountant.post("/fees/payments/initiate", { invoiceId: inv.id, method: "bkash" });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe("PAYMENT_METHOD_DISABLED");
  });
});
