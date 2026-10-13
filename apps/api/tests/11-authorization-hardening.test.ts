import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { Client, startServer, stopServer, seedSchool, loginAs, db, makeUser, type World } from "./helpers/harness";

/**
 * Regression suite for the authorization / data-scope audit. Each test pins
 * one hole that role middleware alone did not close: the caller has the right
 * ROLE but is touching a record that is not THEIRS.
 */
let w: World;
beforeAll(startServer);
afterAll(stopServer);
beforeEach(async () => { w = await seedSchool(); });

/** teacher -> Math in section A; teacher2 -> English in section B. */
async function assignTeachers() {
  const admin = await loginAs(w.admin.email);
  await admin.post("/academics/class-assignments", { shiftId: w.shift.id, classId: w.cls.id, sectionId: w.sectionA.id, subjectId: w.math.id, teacherId: w.teacher.id });
  await admin.post("/academics/class-assignments", { shiftId: w.shift.id, classId: w.cls.id, sectionId: w.sectionB.id, subjectId: w.english.id, teacherId: w.teacher2.id });
  return admin;
}

describe("teacher data isolation", () => {
  it("cannot read the roster or attendance of a section they do not teach", async () => {
    await assignTeachers();
    const t = await loginAs(w.teacherUser.email);
    expect((await t.get(`/academics/sections/${w.sectionA.id}/roster`)).status).toBe(200);
    expect((await t.get(`/academics/sections/${w.sectionB.id}/roster`)).status).toBe(403);
    expect((await t.get(`/attendance?sectionId=${w.sectionB.id}&date=2026-01-10`)).status).toBe(403);
  });

  it("only sees their own class assignments, even when asking for another teacher's", async () => {
    await assignTeachers();
    const t = await loginAs(w.teacherUser.email);
    const r = await t.get(`/academics/class-assignments?teacherId=${w.teacher2.id}`);
    expect(r.body.items.every((a: any) => a.teacherId === w.teacher.id)).toBe(true);
  });

  it("cannot overwrite another section's attendance by smuggling its student into their own section", async () => {
    await assignTeachers();
    const t = await loginAs(w.teacherUser.email);
    const r = await t.post("/attendance", { sectionId: w.sectionA.id, date: "2026-01-10", entries: [{ studentId: w.otherStudent.id, status: "absent" }] });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe("STUDENT_NOT_IN_SECTION");
  });

  it("cannot create exams, enter marks or publish for a section/subject they are not assigned to", async () => {
    const admin = await assignTeachers();
    const t = await loginAs(w.teacherUser.email);
    const bad = await t.post("/exams", { name: "Sneaky", type: "offline", subjectId: w.english.id, sectionId: w.sectionB.id, examDate: "2026-02-01", maxMarks: 50 });
    expect(bad.status).toBe(403); // teachers never create exams

    // an exam that exists in B (created by admin) is off-limits for teacher #1
    const exam = (await admin.post("/exams", { name: "B exam", type: "offline", subjectId: w.english.id, sectionId: w.sectionB.id, examDate: "2026-02-01", maxMarks: 50 })).body.exam;
    expect((await t.post("/exams/marks", { examId: exam.id, entries: [{ studentId: w.otherStudent.id, marksObtained: 5 }] })).status).toBe(403);
    expect((await t.get(`/exams/${exam.id}/marks`)).status).toBe(403);
    expect((await t.post(`/exams/${exam.id}/submit`)).status).toBe(403);
    expect((await t.get("/exams")).body.items.some((e: any) => e.id === exam.id)).toBe(false);
  });

  it("rejects marks above the exam maximum, duplicates, and students outside the section", async () => {
    await assignTeachers();
    const t = await loginAs(w.teacherUser.email);
    const exam = (await (await loginAs(w.admin.email)).post("/exams", { name: "Quiz", type: "offline", subjectId: w.math.id, sectionId: w.sectionA.id, examDate: "2026-02-01", maxMarks: 20 })).body.exam;
    expect((await t.post("/exams/marks", { examId: exam.id, entries: [{ studentId: w.student.id, marksObtained: 21 }] })).body.code).toBe("MARKS_EXCEED_MAX");
    expect((await t.post("/exams/marks", { examId: exam.id, entries: [{ studentId: w.student.id, marksObtained: 5 }, { studentId: w.student.id, marksObtained: 6 }] })).body.code).toBe("DUPLICATE_ENTRIES");
    expect((await t.post("/exams/marks", { examId: exam.id, entries: [{ studentId: w.otherStudent.id, marksObtained: 5 }] })).body.code).toBe("STUDENT_NOT_IN_SECTION");
  });

  it("cannot post resources/assignments to a section they do not teach, nor grade or publish others' work", async () => {
    await assignTeachers();
    const t1 = await loginAs(w.teacherUser.email);
    const t2 = await loginAs(w.teacher2User.email);

    const res = { title: "Notes", kind: "pdf", url: "https://example.com/n.pdf", classId: w.cls.id, subjectId: w.english.id, sectionId: w.sectionB.id };
    expect((await t1.post("/lms/resources", res)).status).toBe(403);
    const mine = (await t2.post("/lms/resources", res)).body.resource;
    expect((await t1.post(`/lms/resources/${mine.id}/publish`)).status).toBe(403);

    const hw = { title: "HW", description: "do it", subjectId: w.english.id, sectionId: w.sectionB.id, dueAt: "2099-01-01T00:00:00.000Z" };
    expect((await t1.post("/lms/assignments", hw)).status).toBe(403);
    const a = (await t2.post("/lms/assignments", hw)).body.assignment;

    const otherStudent = await loginAs(w.otherStudentUser.email);
    const sub = (await otherStudent.post(`/lms/assignments/${a.id}/submissions`, { body: "answer" })).body.submission;
    expect((await t1.get(`/lms/assignments/${a.id}/submissions`)).status).toBe(403);
    expect((await t1.patch(`/lms/submissions/${sub.id}`, { grade: 10, publish: true })).status).toBe(403);
    expect((await t2.patch(`/lms/submissions/${sub.id}`, { grade: 10, publish: true })).status).toBe(200);
  });
});

describe("parent / student data isolation", () => {
  it("a student cannot widen scope with ?sectionId= on exams, resources or assignments", async () => {
    await assignTeachers();
    const s = await loginAs(w.studentUser.email);
    for (const path of ["/exams", "/lms/resources", "/lms/assignments"]) {
      expect((await s.get(`${path}?sectionId=${w.sectionB.id}`)).status).toBe(403);
    }
  });

  it("a parent only gets their own children's marks and submissions", async () => {
    const admin = await assignTeachers();
    const t2 = await loginAs(w.teacher2User.email);
    const exam = (await admin.post("/exams", { name: "B exam", type: "offline", subjectId: w.english.id, sectionId: w.sectionB.id, examDate: "2026-02-01", maxMarks: 50 })).body.exam;
    await t2.post("/exams/marks", { examId: exam.id, entries: [{ studentId: w.otherStudent.id, marksObtained: 44 }] });
    await t2.post(`/exams/${exam.id}/submit`);
    await (await loginAs(w.coordinator.email)).post(`/exams/${exam.id}/approve`);

    const wrongParent = await loginAs(w.parentUser.email);
    expect((await wrongParent.get(`/exams/${exam.id}/marks`)).body.items).toHaveLength(0);
    const rightParent = await loginAs(w.otherParentUser.email);
    expect((await rightParent.get(`/exams/${exam.id}/marks`)).body.items).toHaveLength(1);

    const a = (await t2.post("/lms/assignments", { title: "HW", description: "x", subjectId: w.english.id, sectionId: w.sectionB.id, dueAt: "2099-01-01T00:00:00.000Z" })).body.assignment;
    await (await loginAs(w.otherStudentUser.email)).post(`/lms/assignments/${a.id}/submissions`, { body: "mine" });
    expect((await wrongParent.get(`/lms/assignments/${a.id}/submissions`)).body.items).toHaveLength(0);
    expect((await rightParent.get(`/lms/assignments/${a.id}/submissions`)).body.items).toHaveLength(1);
  });

  it("a student or parent account with no linked student sees NO invoices (not everyone's)", async () => {
    const accountant = await loginAs(w.accountant.email);
    const fs = (await db().feeStructure.create({ data: { name: "Tuition", classId: w.cls.id, shiftId: w.shift.id, year: 2026, amount: 100000 } }));
    await accountant.post("/fees/invoices", { studentId: w.student.id, feeStructureId: fs.id, term: "T1", dueDate: "2099-03-01" });

    const orphanStudent = await makeUser("student", "Orphan Student");
    const orphanParent = await makeUser("parent", "Orphan Parent");
    for (const u of [orphanStudent, orphanParent]) {
      const c = await loginAs(u.email);
      expect((await c.get("/fees/invoices")).body.items).toHaveLength(0);
    }
  });

  it("cannot start an online payment on someone else's invoice", async () => {
    const accountant = await loginAs(w.accountant.email);
    const fs = (await db().feeStructure.create({ data: { name: "Tuition", classId: w.cls.id, shiftId: w.shift.id, year: 2026, amount: 100000 } }));
    const inv = (await accountant.post("/fees/invoices", { studentId: w.student.id, feeStructureId: fs.id, term: "T1", dueDate: "2099-03-01" })).body.invoice;
    const other = await loginAs(w.otherParentUser.email);
    expect((await other.post("/fees/payments/initiate", { invoiceId: inv.id, method: "bkash" })).status).toBe(404);
  });
});

describe("role-restricted modules", () => {
  it("notices are audience-scoped for authenticated users, and the public board shows only 'all'", async () => {
    const admin = await loginAs(w.admin.email);
    for (const audience of ["all", "parents", "students", "teachers", "staff"]) {
      await admin.post("/engagement/notices", { title: `For ${audience}`, bodyHtml: "<p>x</p>", audience, publishNow: true });
    }
    const titles = async (email: string) => (await (await loginAs(email)).get("/engagement/notices")).body.items.map((n: any) => n.title).sort();
    expect(await titles(w.parentUser.email)).toEqual(["For all", "For parents"]);
    expect(await titles(w.studentUser.email)).toEqual(["For all", "For students"]);
    expect(await titles(w.teacherUser.email)).toEqual(["For all", "For staff", "For teachers"]);
    expect(await titles(w.librarian.email)).toEqual(["For all", "For staff"]);
    expect((await titles(w.admin.email)).length).toBe(5);

    const pub = await new Client().get("/public/notices");
    expect(pub.body.items.map((n: any) => n.title)).toEqual(["For all"]);
  });

  it("support tickets: students/teachers cannot list or reply to a parent's ticket", async () => {
    const parent = await loginAs(w.parentUser.email);
    const ticket = (await parent.post("/engagement/tickets", { subject: "Private", body: "my family matter" })).body.ticket;
    for (const email of [w.studentUser.email, w.teacherUser.email, w.librarian.email]) {
      const c = await loginAs(email);
      expect((await c.get("/engagement/tickets")).status).toBe(403);
      expect((await c.post(`/engagement/tickets/${ticket.id}/messages`, { body: "snoop" })).status).toBe(403);
    }
  });

  it("library: ordinary users see only their own loans; librarians see all", async () => {
    const lib = await loginAs(w.librarian.email);
    const book = (await lib.post("/library/books", { title: "Atlas", author: "A", totalCopies: 3 })).body.book;
    await lib.post("/library/issues", { bookId: book.id, borrowerId: w.studentUser.id, dueAt: "2099-01-01" });
    await lib.post("/library/issues", { bookId: book.id, borrowerId: w.otherStudentUser.id, dueAt: "2099-01-01" });

    expect((await (await loginAs(w.studentUser.email)).get("/library/issues")).body.items.map((i: any) => i.borrowerId)).toEqual([w.studentUser.id]);
    expect((await (await loginAs(w.parentUser.email)).get("/library/issues")).body.items).toHaveLength(0);
    expect((await lib.get("/library/issues")).body.items).toHaveLength(2);
    expect((await lib.post("/library/issues", { bookId: book.id, borrowerId: "ghost", dueAt: "2099-01-01" })).body.code).toBe("BORROWER_NOT_FOUND");
  });

  it("uploads: parents/accountants/librarians are refused, and dangerous file types are rejected", async () => {
    const form = (name: string, type: string) => {
      const f = new FormData();
      f.append("file", new Blob([new Uint8Array([1, 2, 3])], { type }), name);
      return f;
    };
    expect((await (await loginAs(w.parentUser.email)).raw("POST", "/uploads", { form: form("a.pdf", "application/pdf") })).status).toBe(403);
    expect((await (await loginAs(w.accountant.email)).raw("POST", "/uploads", { form: form("a.pdf", "application/pdf") })).status).toBe(403);

    const teacher = await loginAs(w.teacherUser.email);
    for (const [name, type] of [["x.html", "text/html"], ["x.svg", "image/svg+xml"], ["x.exe", "application/octet-stream"], ["x.pdf", "text/html"]]) {
      const r = await teacher.raw("POST", "/uploads", { form: form(name, type) });
      expect(r.body.code).toBe("FILE_TYPE_NOT_ALLOWED");
    }
    const ok = await teacher.raw("POST", "/uploads", { form: form("../../etc/My Notes.pdf", "application/pdf") });
    expect(ok.status).toBe(201);
    expect(ok.body.publicId).not.toContain("..");
    expect(ok.body.publicId).toMatch(/-My-Notes$/);

    // students may hand in documents but not upload video
    const student = await loginAs(w.studentUser.email);
    expect((await student.raw("POST", "/uploads", { form: form("clip.mp4", "video/mp4") })).body.code).toBe("FILE_TYPE_NOT_ALLOWED");
  });

  it("salary: parent/student get no access; invalid payslips are rejected", async () => {
    for (const email of [w.parentUser.email, w.studentUser.email]) {
      expect((await (await loginAs(email)).get("/salary")).status).toBe(403);
    }
    const acc = await loginAs(w.accountant.email);
    const base = { month: 1, year: 2026, baseAmount: 100000, deductions: 0, bonuses: 0 };
    expect((await acc.post("/salary", { ...base, staffId: w.parentUser.id })).body.code).toBe("NOT_STAFF");
    expect((await acc.post("/salary", { ...base, staffId: w.teacherUser.id, deductions: 150000 })).body.code).toBe("NEGATIVE_NET");

    const sal = (await acc.post("/salary", { ...base, staffId: w.teacherUser.id })).body.salary;
    await acc.post("/salary/paid", { salaryId: sal.id });
    expect((await acc.post("/salary/paid", { salaryId: sal.id })).status).toBe(409);
    expect((await acc.post("/salary", { ...base, staffId: w.teacherUser.id, bonuses: 5 })).status).toBe(409);

    // staff still see only their own payslips
    expect((await (await loginAs(w.teacherUser.email)).get(`/salary?staffId=${w.librarian.id}`)).body.items.every((s: any) => s.staffId === w.teacherUser.id)).toBe(true);
  });

  it("CMS: a coordinator can draft but cannot publish or edit live public pages", async () => {
    const coord = await loginAs(w.coordinator.email);
    const draft = await coord.post("/cms/pages", { slug: "about", title: "About", bodyHtml: "<p>hi</p>", status: "draft" });
    expect(draft.status).toBe(201);
    expect((await coord.post("/cms/pages", { slug: "live", title: "Live", bodyHtml: "<p>x</p>", status: "published" })).status).toBe(403);
    expect((await coord.patch(`/cms/pages/${draft.body.page.id}`, { status: "published" })).status).toBe(403);

    const admin = await loginAs(w.admin.email);
    expect((await admin.patch(`/cms/pages/${draft.body.page.id}`, { status: "published" })).status).toBe(200);
    expect((await coord.patch(`/cms/pages/${draft.body.page.id}`, { title: "Hijack" })).status).toBe(403);
  });

  it("the attendance report is not exposed to accountants", async () => {
    expect((await (await loginAs(w.accountant.email)).get("/reports/attendance")).status).toBe(403);
    expect((await (await loginAs(w.accountant.email)).get("/reports/fee-collection")).status).toBe(200);
    expect((await (await loginAs(w.coordinator.email)).get("/reports/attendance")).status).toBe(200);
  });
});
