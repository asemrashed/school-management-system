import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { Client, startServer, stopServer, seedSchool, loginAs, db, mailbox, type World } from "./helpers/harness";

let w: World;
beforeAll(startServer);
afterAll(stopServer);
beforeEach(async () => { w = await seedSchool(); });

describe("POST /users (admin-created staff)", () => {
  it("creating a teacher also creates a Teacher profile row (regression: this used to silently not happen)", async () => {
    const admin = await loginAs(w.admin.email);
    const r = await admin.post("/users", { name: "New Teacher", email: "nt@test.school", role: "teacher", password: "Secret123" });
    expect(r.status).toBe(201);
    expect(db().__rows("Teacher").some((t: any) => t.userId === r.body.user.id)).toBe(true);
    expect(mailbox().some((m) => m.to === "nt@test.school")).toBe(true);
  });
  it.each(["admin", "coordinator", "accountant", "librarian"])(
    "creating a %s also creates a Staff profile row",
    async (role) => {
      const admin = await loginAs(w.superAdmin.email);
      const r = await admin.post("/users", { name: `New ${role}`, email: `n-${role}@test.school`, role, password: "Secret123" });
      expect(r.status).toBe(201);
      expect(db().__rows("Staff").some((s: any) => s.userId === r.body.user.id)).toBe(true);
    }
  );
  it("a plain admin CANNOT mint a new super_admin account (only an existing super_admin can)", async () => {
    const admin = await loginAs(w.admin.email);
    const r = await admin.post("/users", { name: "Sneaky", email: "sneaky@test.school", role: "super_admin", password: "Secret123" });
    expect(r.status).toBe(403);
    expect(db().__rows("User").some((u: any) => u.email === "sneaky@test.school")).toBe(false);

    const superAdmin = await loginAs(w.superAdmin.email);
    const ok = await superAdmin.post("/users", { name: "Legit", email: "legit-sa@test.school", role: "super_admin", password: "Secret123" });
    expect(ok.status).toBe(201);
  });
  it("rejects duplicate email", async () => {
    const admin = await loginAs(w.admin.email);
    const r = await admin.post("/users", { name: "Dup", email: w.teacherUser.email, role: "teacher", password: "Secret123" });
    expect(r.status).toBe(409);
  });
  it("only super_admin/admin may create users — every other role is forbidden", async () => {
    for (const email of [w.teacherUser.email, w.parentUser.email, w.studentUser.email, w.accountant.email, w.librarian.email, w.coordinator.email]) {
      const c = await loginAs(email);
      const r = await c.post("/users", { name: "X", email: "x@test.school", role: "teacher", password: "Secret123" });
      expect(r.status, `role of ${email} should be forbidden`).toBe(403);
    }
  });
  it("anonymous requests are rejected, not silently scoped", async () => {
    const r = await new Client().get("/users");
    expect(r.status).toBe(401);
  });
  it("list users never leaks password hashes", async () => {
    const admin = await loginAs(w.admin.email);
    const r = await admin.get("/users");
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body)).not.toMatch(/\$2[aby]\$/);
  });
});

describe("RBAC boundaries across feature areas", () => {
  it("a student cannot create a class assignment", async () => {
    const c = await loginAs(w.studentUser.email);
    const r = await c.post("/academics/class-assignments", { shiftId: w.shift.id, classId: w.cls.id, sectionId: w.sectionA.id, subjectId: w.math.id, teacherId: w.teacher.id });
    expect(r.status).toBe(403);
  });
  it("a teacher cannot access super-admin-only messaging settings", async () => {
    const c = await loginAs(w.teacherUser.email);
    expect((await c.get("/messaging/toggles")).status).toBe(403);
  });
  it("a parent cannot record a payment", async () => {
    const c = await loginAs(w.parentUser.email);
    expect((await c.post("/fees/payments", { invoiceId: "whatever", amount: 100, method: "cash" })).status).toBe(403);
  });
  it("only a parent may open a support ticket (not staff, not students)", async () => {
    for (const email of [w.teacherUser.email, w.studentUser.email, w.admin.email]) {
      const c = await loginAs(email);
      expect((await c.post("/engagement/tickets", { subject: "Question", body: "y" })).status).toBe(403);
    }
    const parent = await loginAs(w.parentUser.email);
    expect((await parent.post("/engagement/tickets", { subject: "Question", body: "y" })).status).toBe(201);
  });
  it("device-limit management is super_admin only, even for a plain admin", async () => {
    const admin = await loginAs(w.admin.email);
    expect((await admin.get("/device/limits")).status).toBe(403);
    const superAdmin = await loginAs(w.superAdmin.email);
    expect((await superAdmin.get("/device/limits")).status).toBe(200);
  });
});
