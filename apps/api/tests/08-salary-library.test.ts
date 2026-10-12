import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { Client, startServer, stopServer, seedSchool, loginAs, db, type World } from "./helpers/harness";

let w: World;
beforeAll(startServer);
afterAll(stopServer);
beforeEach(async () => { w = await seedSchool(); });

describe("salary", () => {
  it("net = base - deductions + bonuses, and a staff member only ever sees their own payslips", async () => {
    const accountant = await loginAs(w.accountant.email);
    const r = await accountant.post("/salary", { staffId: w.teacherUser.id, month: 1, year: 2026, baseAmount: 5000000, deductions: 200000, bonuses: 100000 });
    expect(r.status).toBe(201);
    expect(r.body.salary.netAmount).toBe(4900000);
    expect(r.body.salary.paidAt).toBeNull();

    await accountant.post("/salary", { staffId: w.admin.id, month: 1, year: 2026, baseAmount: 6000000, deductions: 0, bonuses: 0 });

    const teacher = await loginAs(w.teacherUser.email);
    const mine = await teacher.get("/salary");
    expect(mine.body.items).toHaveLength(1);
    expect(mine.body.items[0].staffId).toBe(w.teacherUser.id);
  });
  it("re-submitting the same staff+month+year updates rather than duplicates", async () => {
    const accountant = await loginAs(w.accountant.email);
    await accountant.post("/salary", { staffId: w.teacherUser.id, month: 2, year: 2026, baseAmount: 5000000, deductions: 0, bonuses: 0 });
    await accountant.post("/salary", { staffId: w.teacherUser.id, month: 2, year: 2026, baseAmount: 5500000, deductions: 0, bonuses: 0 });
    const rows = db().__rows("Salary").filter((s: any) => s.staffId === w.teacherUser.id && s.month === 2);
    expect(rows).toHaveLength(1);
    expect(rows[0].baseAmount).toBe(5500000);
  });
  it("mark-paid sets paidAt; only admin/accountant/super_admin can create or mark paid", async () => {
    const accountant = await loginAs(w.accountant.email);
    const sal = (await accountant.post("/salary", { staffId: w.teacherUser.id, month: 3, year: 2026, baseAmount: 5000000, deductions: 0, bonuses: 0 })).body.salary;
    const teacher = await loginAs(w.teacherUser.email);
    expect((await teacher.post("/salary", { staffId: w.teacherUser.id, month: 4, year: 2026, baseAmount: 1, deductions: 0, bonuses: 0 })).status).toBe(403);
    expect((await teacher.post("/salary/paid", { salaryId: sal.id })).status).toBe(403);
    const paid = await accountant.post("/salary/paid", { salaryId: sal.id });
    expect(paid.body.salary.paidAt).not.toBeNull();
  });
});

describe("library", () => {
  async function addBook(librarian: Client, copies = 1, priceForSale?: number) {
    const r = await librarian.post("/library/books", { title: "Physics 101", author: "A. Author", totalCopies: copies, priceForSale });
    return r.body.book;
  }
  it("issuing decrements available copies; issuing with zero available copies is refused", async () => {
    const librarian = await loginAs(w.librarian.email);
    const book = await addBook(librarian, 1);
    const issue = await librarian.post("/library/issues", { bookId: book.id, borrowerId: w.studentUser.id, dueAt: "2026-02-01" });
    expect(issue.status).toBe(201);
    const afterIssue = (await librarian.get("/library/books")).body.items.find((b: any) => b.id === book.id);
    expect(afterIssue.availableCopies).toBe(0);

    const secondIssue = await librarian.post("/library/issues", { bookId: book.id, borrowerId: w.student2User.id, dueAt: "2026-02-01" });
    expect(secondIssue.status).toBe(409);
  });
  it("returning restores the copy; a book returned late accrues a fine, on time accrues none", async () => {
    const librarian = await loginAs(w.librarian.email);
    const onTimeBook = await addBook(librarian, 1);
    const onTime = await librarian.post("/library/issues", { bookId: onTimeBook.id, borrowerId: w.studentUser.id, dueAt: "2099-01-01" });
    const onTimeReturn = await librarian.post("/library/issues/return", { issueId: onTime.body.issue.id });
    expect(onTimeReturn.body.issue.fineAmount).toBe(0);
    const afterReturn = (await librarian.get("/library/books")).body.items.find((b: any) => b.id === onTimeBook.id);
    expect(afterReturn.availableCopies).toBe(1);

    const lateBook = await addBook(librarian, 1);
    const late = await librarian.post("/library/issues", { bookId: lateBook.id, borrowerId: w.studentUser.id, dueAt: "2020-01-01" });
    const lateReturn = await librarian.post("/library/issues/return", { issueId: late.body.issue.id });
    expect(lateReturn.body.issue.fineAmount).toBeGreaterThan(0);
  });
  it("returning an already-returned book is refused, not double-refunded", async () => {
    const librarian = await loginAs(w.librarian.email);
    const book = await addBook(librarian, 1);
    const issue = await librarian.post("/library/issues", { bookId: book.id, borrowerId: w.studentUser.id, dueAt: "2099-01-01" });
    await librarian.post("/library/issues/return", { issueId: issue.body.issue.id });
    const again = await librarian.post("/library/issues/return", { issueId: issue.body.issue.id });
    expect(again.status).toBe(409);
    const book2 = (await librarian.get("/library/books")).body.items.find((b: any) => b.id === book.id);
    expect(book2.availableCopies).toBe(1); // not incremented twice
  });
  it("a sale requires a sale price, deducts stock, and computes amount = price * qty", async () => {
    const librarian = await loginAs(w.librarian.email);
    const lendOnly = await addBook(librarian, 5); // no priceForSale
    const noPricRes = await librarian.post("/library/sales", { bookId: lendOnly.id, buyerId: w.studentUser.id, quantity: 1 });
    expect(noPricRes.status).toBe(400);

    const forSale = await addBook(librarian, 5, 20000);
    const sale = await librarian.post("/library/sales", { bookId: forSale.id, buyerId: w.studentUser.id, quantity: 2 });
    expect(sale.status).toBe(201);
    expect(sale.body.sale.amount).toBe(40000);
    const after = (await librarian.get("/library/books")).body.items.find((b: any) => b.id === forSale.id);
    expect(after.availableCopies).toBe(3);

    const tooMany = await librarian.post("/library/sales", { bookId: forSale.id, buyerId: w.studentUser.id, quantity: 100 });
    expect(tooMany.status).toBe(409);
  });
  it("only librarian/admin/super_admin manage the catalog and issues", async () => {
    const teacher = await loginAs(w.teacherUser.email);
    expect((await teacher.post("/library/books", { title: "x", author: "y", totalCopies: 1 })).status).toBe(403);
  });
});
