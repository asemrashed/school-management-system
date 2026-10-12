import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { createStorageProvider } from "@packages/config";
import { startServer, stopServer, seedSchool, loginAs, db, type World } from "./helpers/harness";

let w: World;
beforeAll(async () => { await startServer(); });
afterAll(stopServer);
beforeEach(async () => { w = await seedSchool(); });

describe("lookup pickers by role", () => {
  it("accountant: students, classes, fee structures, staff; not guardians or users", async () => {
    await db().feeStructure.create({ data: { name: "Tuition", classId: w.cls.id, shiftId: w.shift.id, year: 2026, amount: 250000, kind: "monthly" } });
    const acc = await loginAs(w.accountant.email);
    expect((await acc.get("/lookup/feeStructures")).body.items[0]).toMatchObject({ label: "Tuition" });
    expect((await acc.get("/lookup/staff?q=tina")).body.items.map((i: any) => i.label)).toEqual(["Tina Teacher"]);
    expect((await acc.get("/lookup/students")).status).toBe(200);
    expect((await acc.get("/lookup/guardians")).status).toBe(403);
    expect((await acc.get("/lookup/users")).status).toBe(403);
  });

  it("staff lookup excludes students and parents", async () => {
    const admin = await loginAs(w.admin.email);
    const labels = (await admin.get("/lookup/staff")).body.items.map((i: any) => i.label);
    expect(labels).toContain("Tina Teacher");
    expect(labels).not.toContain("Sam Student");
    expect(labels).not.toContain("Pat Parent");
  });

  it("librarian can search users only; teachers cannot reach fee, staff or user lists", async () => {
    const lib = await loginAs(w.librarian.email);
    expect((await lib.get("/lookup/users?q=sam")).body.items[0].label).toBe("Sam Student");
    expect((await lib.get("/lookup/students")).status).toBe(403);
    const teacher = await loginAs(w.teacherUser.email);
    for (const kind of ["feeStructures", "staff", "users", "guardians"]) {
      expect((await teacher.get(`/lookup/${kind}`)).status).toBe(403);
    }
  });

  it("admin can search guardians by name", async () => {
    const admin = await loginAs(w.admin.email);
    const items = (await admin.get("/lookup/guardians?q=pat")).body.items;
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe("Pat Parent");
  });
});

describe("fee structure shift", () => {
  it("defaults to the class's shift when omitted; rejects unknown classes", async () => {
    const acc = await loginAs(w.accountant.email);
    const ok = await acc.post("/fees/structures", { name: "Admission", classId: w.cls.id, year: 2026, amount: 500000, kind: "admission" });
    expect(ok.status).toBe(201);
    expect(ok.body.feeStructure.shiftId).toBe(w.shift.id);
    expect((await acc.post("/fees/structures", { name: "x", classId: "nope", year: 2026, amount: 1 })).status).toBe(400);
  });
});

describe("local storage provider", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sms-uploads-"));
  const provider = createStorageProvider({ STORAGE_PROVIDER: "local", UPLOAD_DIR: root, PUBLIC_API_URL: "http://localhost:4000/" } as any);

  it("writes inside the upload folder and returns a /files URL", async () => {
    const res = await provider.upload(Buffer.from("hello"), "school/admin", "abc-photo.png");
    expect(res.url).toBe("http://localhost:4000/files/school/admin/abc-photo.png");
    expect(fs.readFileSync(path.join(root, res.publicId), "utf8")).toBe("hello");
    await provider.delete(res.publicId);
    expect(fs.existsSync(path.join(root, res.publicId))).toBe(false);
  });

  it("refuses paths that escape the upload folder", async () => {
    await expect(provider.upload(Buffer.from("x"), "../../etc", "passwd")).rejects.toThrow(/Invalid storage path/);
    await expect(provider.delete("../outside.txt")).rejects.toThrow(/Invalid storage path/);
  });
});
