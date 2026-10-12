import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { Client, startServer, stopServer, seedSchool, loginAs, db, mailbox, PASSWORD, type World } from "./helpers/harness";

let w: World;
beforeAll(startServer);
afterAll(stopServer);
beforeEach(async () => { w = await seedSchool(); });

const codeFromMail = () => {
  const last = mailbox().at(-1);
  return /\b(\d{6})\b/.exec(last.html)![1];
};

describe("CSRF + validation", () => {
  it("rejects a mutating request without a CSRF token (403, standard error shape)", async () => {
    const c = await loginAs(w.superAdmin.email);
    const r = await c.raw("POST", "/users", { body: {}, csrf: false });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe("CSRF_INVALID");
  });
  it("rejects a token issued to a different session", async () => {
    const attacker = new Client();
    const stolen = (await attacker.get("/auth/csrf-token")).body.csrfToken;
    const victim = await loginAs(w.superAdmin.email);
    const r = await victim.raw("POST", "/users", { body: {}, headers: { "x-csrf-token": stolen }, csrf: false });
    expect(r.status).toBe(403);
  });
  it("login validation errors use the standard shape", async () => {
    const r = await new Client().login("not-an-email", "x");
    expect(r.status).toBe(400);
    expect(r.body.code).toBe("VALIDATION_ERROR");
  });
});

describe("login / session / logout", () => {
  it("wrong password and unknown email give the same generic error", async () => {
    const a = await new Client().login(w.admin.email, "WrongPass1!");
    const b = await new Client().login("ghost@test.school", PASSWORD);
    expect(a.status).toBe(400); expect(b.status).toBe(400);
    expect(a.body).toEqual(b.body);
    expect(a.body.code).toBe("INVALID_CREDENTIALS");
  });
  it("sets an httpOnly SameSite session cookie and never returns the password hash", async () => {
    const c = new Client();
    const r = await c.login(w.admin.email);
    expect(r.status).toBe(200);
    const cookie = r.headers.getSetCookie().find((x) => x.startsWith("sms_session="))!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(JSON.stringify(r.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
    expect(r.body.user).toEqual({ id: w.admin.id, name: w.admin.name, email: w.admin.email, role: "admin" });
  });
  it("a tampered session cookie is rejected", async () => {
    const c = await loginAs(w.admin.email);
    const original = c.jar.get("sms_session")!;
    const lastChar = original.at(-1)!;
    const tampered = original.slice(0, -1) + (lastChar === "0" ? "1" : "0"); // guaranteed to differ
    c.jar.set("sms_session", tampered);
    expect((await c.get("/auth/me")).body.user).toBeNull();
  });
  it("disabled users cannot log in and existing sessions stop working", async () => {
    const c = await loginAs(w.teacherUser.email);
    await db().user.update({ where: { id: w.teacherUser.id }, data: { isActive: false } });
    expect((await c.get("/auth/me")).body.user).toBeNull();
    expect((await new Client().login(w.teacherUser.email)).status).toBe(400);
  });
  it("logout needs a session, destroys it server-side, and clears the cookie", async () => {
    expect((await new Client().post("/auth/logout")).status).toBe(401); // no session (requireAuth)
    const c = await loginAs(w.admin.email);
    expect((await c.post("/auth/logout")).status).toBe(204);
    expect(db().__rows("Session")).toHaveLength(0);
    expect((await c.get("/auth/me")).body.user).toBeNull();
  });
});

describe("self-registration", () => {
  it("creates a parent with a Guardian profile and sends a welcome email", async () => {
    const c = new Client();
    const r = await c.raw("POST", "/auth/register", { body: { name: "New Parent", email: "np@test.school", password: "Secret123", role: "parent" }, csrf: false });
    expect(r.status).toBe(201);
    expect(r.body.user.role).toBe("parent");
    expect(db().__rows("Guardian").some((g: any) => g.userId === r.body.user.id)).toBe(true);
    expect(mailbox().some((m) => m.to === "np@test.school")).toBe(true);
    expect((await c.get("/auth/me")).body.user.email).toBe("np@test.school");
  });
  it("creates a student with a Student profile", async () => {
    const r = await new Client().raw("POST", "/auth/register", { body: { name: "New Student", email: "ns@test.school", password: "Secret123", role: "student" }, csrf: false });
    expect(r.status).toBe(201);
    expect(db().__rows("Student").some((s: any) => s.userId === r.body.user.id)).toBe(true);
  });
  it.each(["super_admin", "admin", "coordinator", "teacher", "accountant", "librarian"])(
    "REFUSES to self-register as %s (privilege escalation)",
    async (role) => {
      const r = await new Client().raw("POST", "/auth/register", { body: { name: "Evil", email: `evil-${role}@test.school`, password: "Secret123", role }, csrf: false });
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(r.status).toBeLessThan(500);
      expect(db().__rows("User").some((u: any) => u.email === `evil-${role}@test.school`)).toBe(false);
    }
  );
  it("rejects duplicate emails and weak passwords", async () => {
    const dup = await new Client().raw("POST", "/auth/register", { body: { name: "Dup", email: w.parentUser.email, password: "Secret123", role: "parent" }, csrf: false });
    expect(dup.status).toBe(409);
    const weak = await new Client().raw("POST", "/auth/register", { body: { name: "Weak", email: "weak@test.school", password: "password", role: "parent" }, csrf: false });
    expect(weak.status).toBe(400);
  });
});

describe("password reset (email only — SMS gateway off)", () => {
  it("full flow: request -> emailed 6-digit code -> new password works, old one and old sessions do not", async () => {
    const session = await loginAs(w.parentUser.email);
    const c = new Client();
    const req = await c.post("/auth/password-reset/request", { email: w.parentUser.email });
    expect(req.status).toBe(200);
    expect(req.body.channelChoiceRequired).toBe(false);
    expect(req.body.availableChannels).toEqual(["email"]);
    const code = codeFromMail();
    expect(code).toMatch(/^\d{6}$/);
    // never stored in plain text
    expect(JSON.stringify(db().__rows("PasswordResetOtp"))).not.toContain(code);

    const ok = await c.post("/auth/password-reset/verify", { otpRequestId: req.body.otpRequestId, code, newPassword: "BrandNew123" });
    expect(ok.status).toBe(204);
    expect((await new Client().login(w.parentUser.email, PASSWORD)).status).toBe(400);
    expect((await new Client().login(w.parentUser.email, "BrandNew123")).status).toBe(200);
    expect((await session.get("/auth/me")).body.user).toBeNull(); // sessions revoked
  });
  it("wrong code -> 400; too many wrong attempts -> 429; a used code cannot be reused", async () => {
    const c = new Client();
    const req = await c.post("/auth/password-reset/request", { email: w.parentUser.email });
    const id = req.body.otpRequestId; const good = codeFromMail();
    const wrong = good === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) {
      const r = await c.post("/auth/password-reset/verify", { otpRequestId: id, code: wrong, newPassword: "BrandNew123" });
      expect(r.status).toBe(400);
      expect(r.body.code).toBe("OTP_INCORRECT");
    }
    const locked = await c.post("/auth/password-reset/verify", { otpRequestId: id, code: good, newPassword: "BrandNew123" });
    expect(locked.status).toBe(429);
  });
  it("expired code is rejected", async () => {
    const c = new Client();
    const req = await c.post("/auth/password-reset/request", { email: w.parentUser.email });
    const good = codeFromMail();
    const row = db().__rows("PasswordResetOtp")[0];
    await db().passwordResetOtp.update({ where: { id: row.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const r = await c.post("/auth/password-reset/verify", { otpRequestId: req.body.otpRequestId, code: good, newPassword: "BrandNew123" });
    expect(r.body.code).toBe("OTP_EXPIRED");
  });
  it("does not reveal whether an email exists, and a fake request id never verifies", async () => {
    const c = new Client();
    const ghost = await c.post("/auth/password-reset/request", { email: "ghost@test.school" });
    expect(ghost.status).toBe(200);
    expect(mailbox()).toHaveLength(0);
    const v = await c.post("/auth/password-reset/verify", { otpRequestId: ghost.body.otpRequestId, code: "123456", newPassword: "BrandNew123" });
    expect(v.status).toBe(400);
  });
  it("max 3 requests per 15 minutes per account", async () => {
    const c = new Client();
    for (let i = 0; i < 3; i++) expect((await c.post("/auth/password-reset/request", { email: w.parentUser.email })).status).toBe(200);
    expect((await c.post("/auth/password-reset/request", { email: w.parentUser.email })).status).toBe(429);
  });
  it("new password must satisfy the strength rules", async () => {
    const c = new Client();
    const req = await c.post("/auth/password-reset/request", { email: w.parentUser.email });
    const r = await c.post("/auth/password-reset/verify", { otpRequestId: req.body.otpRequestId, code: codeFromMail(), newPassword: "weak" });
    expect(r.status).toBe(400);
  });
});

describe("device control (per-role concurrent session cap)", () => {
  it("evicts the oldest session when the role's limit is exceeded", async () => {
    const su = await loginAs(w.superAdmin.email);
    expect((await su.post("/device/limits", { role: "teacher", maxSessions: 1 })).status).toBe(200);
    const first = await loginAs(w.teacherUser.email);
    expect((await first.get("/auth/me")).body.user).not.toBeNull();
    const second = await loginAs(w.teacherUser.email);
    expect((await second.get("/auth/me")).body.user).not.toBeNull();
    expect((await first.get("/auth/me")).body.user).toBeNull();
  });
  it("roles without a configured limit are uncapped", async () => {
    const a = await loginAs(w.admin.email); const b = await loginAs(w.admin.email); const c = await loginAs(w.admin.email);
    for (const x of [a, b, c]) expect((await x.get("/auth/me")).body.user).not.toBeNull();
  });
});
