import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { Client, startServer, stopServer, seedSchool, type World, loginAs } from "./helpers/harness";

let w: World;
beforeAll(async () => { await startServer(); w = await seedSchool(); });
afterAll(stopServer);

describe("smoke", () => {
  it("health check", async () => {
    const r = await new Client().get("/health");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ status: "ok" });
  });
  it("unknown route -> 404 in standard error shape", async () => {
    const r = await new Client().get("/nope");
    expect(r.status).toBe(404);
    expect(r.body.code).toBe("NOT_FOUND");
  });
  it("login works against the fake db", async () => {
    const c = await loginAs(w.superAdmin.email);
    const me = await c.get("/auth/me");
    expect(me.body.user.role).toBe("super_admin");
  });
});
