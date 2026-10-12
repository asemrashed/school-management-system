import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { Client, startServer, stopServer, seedSchool, loginAs, type World } from "./helpers/harness";

let w: World;
beforeAll(startServer);
afterAll(stopServer);
beforeEach(async () => { w = await seedSchool(); });

describe("uploads endpoint", () => {
  it("requires authentication (with a valid CSRF pairing, isolating the auth check itself)", async () => {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array([1])]), "a.pdf");
    const r = await new Client().raw("POST", "/uploads", { form }); // csrf defaults true -> auto-fetches a valid token
    expect(r.status).toBe(401);
  });
  it("a POST with no CSRF token at all is rejected before auth is even checked", async () => {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array([1])]), "a.pdf");
    const r = await new Client().raw("POST", "/uploads", { form, csrf: false });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe("CSRF_INVALID");
  });
  it("400s with a clear error when no file is attached", async () => {
    const teacher = await loginAs(w.teacherUser.email);
    const r = await teacher.raw("POST", "/uploads", { form: new FormData() });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe("NO_FILE");
  });
});

describe("rate limiting", () => {
  it("login is actually throttled after repeated attempts (not just decorative)", async () => {
    const prev = process.env.RATE_LIMIT_DISABLED;
    process.env.RATE_LIMIT_DISABLED = "false";
    try {
      const c = new Client();
      let last = 0;
      for (let i = 0; i < 12; i++) last = (await c.login("nope@test.school", "wrong")).status;
      expect(last).toBe(429);
    } finally {
      process.env.RATE_LIMIT_DISABLED = prev;
    }
  });
});

describe("error shape consistency", () => {
  it("a Zod validation failure always returns the standard { code, message, details } shape", async () => {
    const admin = await loginAs(w.admin.email);
    const r = await admin.post("/users", { name: "", email: "not-an-email", role: "teacher", password: "x" });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(r.body.details.issues)).toBe(true);
  });
});
