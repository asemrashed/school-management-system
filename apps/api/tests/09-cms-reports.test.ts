import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { Client, startServer, stopServer, seedSchool, loginAs, db, type World } from "./helpers/harness";

let w: World;
beforeAll(startServer);
afterAll(stopServer);
beforeEach(async () => { w = await seedSchool(); });

describe("CMS pages — draft/review/published workflow + public access", () => {
  it("a draft page is not publicly visible; publishing makes it visible with sanitized HTML", async () => {
    const admin = await loginAs(w.admin.email);
    const create = await admin.post("/cms/pages", { slug: "about", title: "About us", bodyHtml: "<p>Hi</p><script>bad()</script>", status: "draft" });
    expect(create.status).toBe(201);
    expect(create.body.page.bodyHtml).not.toMatch(/<script/i);

    const anonDraft = await new Client().get("/public/pages/about");
    expect(anonDraft.status).toBe(404);

    const publish = await admin.patch(`/cms/pages/${create.body.page.id}`, { status: "published" });
    expect(publish.body.page.publishedAt).not.toBeNull();

    const anonPublished = await new Client().get("/public/pages/about");
    expect(anonPublished.status).toBe(200);
    expect(anonPublished.body.page.title).toBe("About us");
  });
  it("multi-segment slugs work through the catch-all (e.g. policies/refund)", async () => {
    const admin = await loginAs(w.admin.email);
    await admin.post("/cms/pages", { slug: "policies/refund", title: "Refund policy", bodyHtml: "<p>...</p>", status: "published" });
    const r = await new Client().get("/public/pages/policies/refund");
    expect(r.status).toBe(200);
    expect(r.body.page.title).toBe("Refund policy");
  });
  it("duplicate slugs are rejected; only admin/coordinator/super_admin manage pages", async () => {
    const admin = await loginAs(w.admin.email);
    await admin.post("/cms/pages", { slug: "contact", title: "Contact", bodyHtml: "<p>x</p>" });
    const dup = await admin.post("/cms/pages", { slug: "contact", title: "Contact 2", bodyHtml: "<p>y</p>" });
    expect(dup.status).toBe(409);

    const teacher = await loginAs(w.teacherUser.email);
    expect((await teacher.post("/cms/pages", { slug: "x", title: "X", bodyHtml: "<p>x</p>" })).status).toBe(403);
  });
});

describe("public notice board (no auth required)", () => {
  it("published notices for 'all'/'parents'/'students' are public; a 'staff'-only notice is not", async () => {
    const admin = await loginAs(w.admin.email);
    await admin.post("/engagement/notices", { title: "Holiday", bodyHtml: "<p>x</p>", audience: "all", publishNow: true });
    await admin.post("/engagement/notices", { title: "Payroll memo", bodyHtml: "<p>x</p>", audience: "staff", publishNow: true });
    const anon = await new Client().get("/public/notices");
    expect(anon.status).toBe(200);
    const titles = anon.body.items.map((n: any) => n.title);
    expect(titles).toContain("Holiday");
    expect(titles).not.toContain("Payroll memo");
  });
});

describe("reports (admin/accountant/super_admin only)", () => {
  it("fee-collection totals reflect actual invoices/payments", async () => {
    const accountant = await loginAs(w.accountant.email);
    const fs = (await accountant.post("/fees/structures", { name: "T", classId: w.cls.id, shiftId: w.shift.id, year: 2026, amount: 100000 })).body.feeStructure;
    const inv = (await accountant.post("/fees/invoices", { studentId: w.student.id, feeStructureId: fs.id, term: "T1", dueDate: "2099-01-01" })).body.invoice;
    await accountant.post("/fees/payments", { invoiceId: inv.id, amount: 40000, method: "cash" });

    const report = await accountant.get("/reports/fee-collection");
    expect(report.status).toBe(200);
    expect(report.body.totalDue).toBeGreaterThanOrEqual(100000);
    expect(report.body.totalCollected).toBeGreaterThanOrEqual(40000);
  });
  it("attendance % is computed correctly for a section", async () => {
    const admin = await loginAs(w.admin.email);
    await admin.post("/academics/class-assignments", { shiftId: w.shift.id, classId: w.cls.id, sectionId: w.sectionA.id, subjectId: w.math.id, teacherId: w.teacher.id });
    const teacher = await loginAs(w.teacherUser.email);
    await teacher.post("/attendance", { sectionId: w.sectionA.id, date: "2026-01-10", entries: [{ studentId: w.student.id, status: "present" }, { studentId: w.student2.id, status: "absent" }] });
    const report = await admin.get("/reports/attendance");
    const row = report.body.items.find((r: any) => r.sectionId === w.sectionA.id);
    expect(row.presentCount).toBe(1);
    expect(row.totalCount).toBe(2);
    expect(row.percentage).toBe(50);
  });
  it("defaulter list only includes unpaid/partial/overdue, never fully-paid invoices", async () => {
    const accountant = await loginAs(w.accountant.email);
    const fs = (await accountant.post("/fees/structures", { name: "T", classId: w.cls.id, shiftId: w.shift.id, year: 2026, amount: 50000 })).body.feeStructure;
    const paidInv = (await accountant.post("/fees/invoices", { studentId: w.student.id, feeStructureId: fs.id, term: "T1", dueDate: "2099-01-01" })).body.invoice;
    await accountant.post("/fees/payments", { invoiceId: paidInv.id, amount: 50000, method: "cash" });
    const unpaidInv = (await accountant.post("/fees/invoices", { studentId: w.student2.id, feeStructureId: fs.id, term: "T1", dueDate: "2099-01-01" })).body.invoice;

    const defaulters = await accountant.get("/reports/defaulters");
    const ids = defaulters.body.items.map((d: any) => d.invoiceId);
    expect(ids).toContain(unpaidInv.id);
    expect(ids).not.toContain(paidInv.id);
  });
  it("a teacher cannot access reports", async () => {
    const teacher = await loginAs(w.teacherUser.email);
    expect((await teacher.get("/reports/fee-collection")).status).toBe(403);
    expect((await teacher.get("/reports/attendance")).status).toBe(403);
    expect((await teacher.get("/reports/defaulters")).status).toBe(403);
  });
});
