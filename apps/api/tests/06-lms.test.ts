import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { Client, startServer, stopServer, seedSchool, loginAs, db, uploads, type World } from "./helpers/harness";

let w: World;
beforeAll(startServer);
afterAll(stopServer);
beforeEach(async () => {
  w = await seedSchool();
  const admin = await loginAs(w.admin.email);
  await admin.post("/academics/class-assignments", { shiftId: w.shift.id, classId: w.cls.id, sectionId: w.sectionA.id, subjectId: w.math.id, teacherId: w.teacher.id });
});

describe("resources — publish gating (lms-domain.md: invisible until published)", () => {
  it("an unpublished resource is invisible to a student/parent in that section, visible to staff", async () => {
    const teacher = await loginAs(w.teacherUser.email);
    const r = await teacher.post("/lms/resources", {
      title: "Algebra notes", kind: "pdf", url: "https://files.example.com/algebra.pdf",
      classId: w.cls.id, sectionId: w.sectionA.id, subjectId: w.math.id, publishNow: false,
    });
    expect(r.status).toBe(201);

    const student = await loginAs(w.studentUser.email);
    expect((await student.get("/lms/resources")).body.items).toHaveLength(0);
    const parent = await loginAs(w.parentUser.email);
    expect((await parent.get("/lms/resources")).body.items).toHaveLength(0);

    const admin = await loginAs(w.admin.email);
    expect((await admin.get("/lms/resources")).body.items).toHaveLength(1);

    const publish = await teacher.post(`/lms/resources/${r.body.resource.id}/publish`);
    expect(publish.status).toBe(200);
    expect((await student.get("/lms/resources")).body.items).toHaveLength(1);
  });
  it("a student in a different section never sees resources scoped to another section", async () => {
    const teacher = await loginAs(w.teacherUser.email);
    await teacher.post("/lms/resources", { title: "A", kind: "pdf", url: "https://x/a.pdf", classId: w.cls.id, sectionId: w.sectionA.id, subjectId: w.math.id, publishNow: true });
    const otherStudent = await loginAs(w.otherStudentUser.email); // in sectionB
    expect((await otherStudent.get("/lms/resources")).body.items).toHaveLength(0);
  });
  it("only a teacher (with a Teacher profile) can create a resource — not admin, not a bare role", async () => {
    const admin = await loginAs(w.admin.email);
    const r = await admin.post("/lms/resources", { title: "A", kind: "pdf", url: "https://x/a.pdf", classId: w.cls.id, sectionId: w.sectionA.id, subjectId: w.math.id });
    expect(r.status).toBe(403);
  });
  it("a real file upload flows through to a Cloudinary URL and can be used as a resource link", async () => {
    const teacher = await loginAs(w.teacherUser.email);
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array([1, 2, 3, 4])], { type: "application/pdf" }), "notes.pdf");
    const up = await teacher.raw("POST", "/uploads", { form });
    expect(up.status).toBe(201);
    expect(up.body.url).toMatch(/^https:\/\/res\.cloudinary\.com\//);
    expect(uploads()).toHaveLength(1);

    const res = await teacher.post("/lms/resources", { title: "Uploaded", kind: "pdf", url: up.body.url, classId: w.cls.id, sectionId: w.sectionA.id, subjectId: w.math.id, publishNow: true });
    expect(res.status).toBe(201);
    expect(res.body.resource.url).toBe(up.body.url);
  });
});

describe("assignments & submissions — grade gating", () => {
  async function postAssignment() {
    const teacher = await loginAs(w.teacherUser.email);
    const r = await teacher.post("/lms/assignments", { title: "Worksheet 1", description: "Do questions 1-5", subjectId: w.math.id, sectionId: w.sectionA.id, dueAt: "2099-01-01T00:00:00.000Z" });
    return r.body.assignment;
  }
  it("a student outside the section cannot submit (no submission created)", async () => {
    const a = await postAssignment();
    const otherStudent = await loginAs(w.otherStudentUser.email);
    const r = await otherStudent.post(`/lms/assignments/${a.id}/submissions`, { body: "answer" });
    // Either forbidden or accepted-but-irrelevant would both be acceptable API designs,
    // but silently accepting cross-section submissions is not: assert it's rejected.
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
  it("grade and feedback are hidden from the student until the teacher publishes them", async () => {
    const a = await postAssignment();
    const student = await loginAs(w.studentUser.email);
    const sub = (await student.post(`/lms/assignments/${a.id}/submissions`, { body: "My answer" })).body.submission;
    expect(sub.grade).toBeNull();

    const teacher = await loginAs(w.teacherUser.email);
    const graded = await teacher.patch(`/lms/submissions/${sub.id}`, { grade: 8, feedback: "Good", publish: false });
    expect(graded.body.submission.grade).toBeNull(); // saved but not published

    const stillHidden = await student.get(`/lms/assignments/${a.id}/submissions`);
    expect(stillHidden.body.items[0].grade).toBeNull();

    await teacher.patch(`/lms/submissions/${sub.id}`, { grade: 8, feedback: "Good", publish: true });
    const now = await student.get(`/lms/assignments/${a.id}/submissions`);
    expect(now.body.items[0].grade).toBe(8);
    expect(now.body.items[0].feedback).toBe("Good");
  });
  it("resubmitting updates the same submission (unique per assignment+student), not a duplicate", async () => {
    const a = await postAssignment();
    const student = await loginAs(w.studentUser.email);
    await student.post(`/lms/assignments/${a.id}/submissions`, { body: "v1" });
    await student.post(`/lms/assignments/${a.id}/submissions`, { body: "v2" });
    const rows = db().__rows("Submission").filter((s: any) => s.assignmentId === a.id && s.studentId === w.student.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].body).toBe("v2");
  });
  it("a student only ever sees their own submission when listing, never a classmate's", async () => {
    const a = await postAssignment();
    const s1 = await loginAs(w.studentUser.email);
    const s2 = await loginAs(w.student2User.email);
    await s1.post(`/lms/assignments/${a.id}/submissions`, { body: "s1 answer" });
    await s2.post(`/lms/assignments/${a.id}/submissions`, { body: "s2 answer" });
    const seenByS1 = await s1.get(`/lms/assignments/${a.id}/submissions`);
    expect(seenByS1.body.items).toHaveLength(1);
    expect(seenByS1.body.items[0].body).toBe("s1 answer");
  });
  it("creating an assignment emails guardians in that section (assignment_posted)", async () => {
    const { mailbox } = await import("./helpers/harness");
    mailbox().length = 0;
    await postAssignment();
    expect(mailbox().some((m: any) => m.to === w.parentUser.email && /New assignment/.test(m.subject))).toBe(true);
  });
});
