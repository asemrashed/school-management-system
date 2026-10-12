import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { startServer, stopServer, seedSchool, loginAs, db, mailbox, Client, type World } from "./helpers/harness";

let w: World;
let base = "";
beforeAll(async () => { base = await startServer(); });
afterAll(stopServer);
beforeEach(async () => { w = await seedSchool(); });

const anon = () => new Client();
const goodApplication = (cls: string, extra: Record<string, unknown> = {}) => ({
  studentName: "Rina Rahman",
  appliedClassId: cls,
  guardianName: "Karim Rahman",
  guardianPhone: "01711111111",
  guardianEmail: "karim@example.com",
  ...extra,
});

describe("public site payload", () => {
  it("renders a complete site on a fresh install, using the real school name", async () => {
    const res = await anon().get("/public/site");
    expect(res.status).toBe(200);
    expect(res.body.general.schoolName).toBe("Test School");
    expect(res.body.general.nav).toHaveLength(5);
    expect(res.body.home.features.length).toBeGreaterThan(0);
    expect(res.body.admission.open).toBe(true);
    expect(res.body.classes).toEqual([{ id: w.cls.id, name: "Class 6" }]);
  });

  it("only lists teachers an admin chose to show, and hides private fields", async () => {
    await db().teacher.update({ where: { id: w.teacher.id }, data: { showOnWebsite: true, designation: "Head of Maths" } });
    const res = await anon().get("/public/site");
    expect(res.body.teachers).toHaveLength(1);
    expect(res.body.teachers[0]).toMatchObject({ name: "Tina Teacher", designation: "Head of Maths" });
    expect(JSON.stringify(res.body)).not.toContain("01711111111"); // teacher phone
    expect(JSON.stringify(res.body)).not.toContain("@test.school");
  });
});

describe("site settings (admin)", () => {
  it("lets an admin edit and the public site reflect it; partial legacy values still render", async () => {
    const admin = await loginAs(w.admin.email);
    const cur = (await admin.get("/site/settings")).body.home;
    const put = await admin.raw("PUT", "/site/settings/home", { body: { ...cur, heroTitle: "Welcome to BD School" } });
    expect(put.status).toBe(200);
    expect((await anon().get("/public/site")).body.home.heroTitle).toBe("Welcome to BD School");

    // A row saved before a field existed must not break the page.
    await db().siteSetting.update({ where: { key: "home" }, data: { value: { heroTitle: "Old row" } } });
    const site = (await anon().get("/public/site")).body;
    expect(site.home.heroTitle).toBe("Old row");
    expect(site.home.features.length).toBeGreaterThan(0);
  });

  it("rejects unsafe URLs, unknown keys, and non-admins", async () => {
    const admin = await loginAs(w.admin.email);
    const g = (await admin.get("/site/settings")).body.general;
    const bad = await admin.raw("PUT", "/site/settings/general", { body: { ...g, logoUrl: "javascript:alert(1)" } });
    expect(bad.status).toBe(400);
    expect((await admin.raw("PUT", "/site/settings/secrets", { body: {} })).status).toBe(400);

    const teacher = await loginAs(w.teacherUser.email);
    expect((await teacher.get("/site/settings")).status).toBe(403);
    expect((await teacher.raw("PUT", "/site/settings/general", { body: g })).status).toBe(403);
    expect((await anon().get("/site/settings")).status).toBe(401);
  });
});

describe("contact form", () => {
  it("stores the message; admin reads and marks it", async () => {
    const res = await anon().post("/public/contact", { name: "Parent", email: "p@example.com", message: "What are the admission dates?" });
    expect(res.status).toBe(201);
    const admin = await loginAs(w.admin.email);
    const list = (await admin.get("/site/contact-messages")).body.items;
    expect(list).toHaveLength(1);
    expect(list[0].isRead).toBe(false);
    expect((await admin.post(`/site/contact-messages/${list[0].id}/read`)).status).toBe(204);
    expect((await admin.get("/site/contact-messages")).body.items[0].isRead).toBe(true);
  });

  it("silently drops honeypot submissions and rejects bad input", async () => {
    const bot = await anon().post("/public/contact", { name: "Bot", email: "b@example.com", message: "buy cheap stuff now", website: "http://spam" });
    expect(bot.status).toBe(201);
    expect(db().__rows("ContactMessage")).toHaveLength(0);
    expect((await anon().post("/public/contact", { name: "X", email: "nope", message: "short" })).status).toBe(400);
  });

  it("is rate limited per client", async () => {
    const prev = process.env.RATE_LIMIT_DISABLED;
    process.env.RATE_LIMIT_DISABLED = "false";
    try {
      const c = anon();
      let last = 0;
      for (let i = 0; i < 12; i++) {
        last = (await c.post("/public/contact", { name: "Parent", email: "p@example.com", message: "Hello there school" })).status;
      }
      expect(last).toBe(429);
    } finally { process.env.RATE_LIMIT_DISABLED = prev; }
  });
});

describe("admission applications", () => {
  it("accepts an application, emails an escaped acknowledgement, and the office can see it", async () => {
    const res = await anon().post("/public/admission", goodApplication(w.cls.id, { guardianName: "<b>Karim</b>" }));
    expect(res.status).toBe(201);
    const mail = mailbox().find((m) => m.to === "karim@example.com");
    expect(mail).toBeTruthy();
    expect(mail.html).not.toContain("<b>Karim</b>");
    expect(mail.html).toContain("&lt;b&gt;");

    const coord = await loginAs(w.coordinator.email);
    const items = (await coord.get("/site/applications?status=new")).body.items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ studentName: "Rina Rahman", appliedClassName: "Class 6", status: "new" });
  });

  it("refuses when admissions are closed, for unknown classes, and honeypot fills", async () => {
    expect((await anon().post("/public/admission", goodApplication("no-such-class"))).status).toBe(400);
    await anon().post("/public/admission", goodApplication(w.cls.id, { website: "x" }));
    expect(db().__rows("AdmissionApplication")).toHaveLength(0);

    const admin = await loginAs(w.admin.email);
    const a = (await admin.get("/site/settings")).body.admission;
    await admin.raw("PUT", "/site/settings/admission", { body: { ...a, open: false } });
    const closed = await anon().post("/public/admission", goodApplication(w.cls.id));
    expect(closed.status).toBe(400);
    expect(closed.body.code).toBe("ADMISSION_CLOSED");
  });

  it("rejects once; a reviewed application cannot be rejected again; teachers are blocked", async () => {
    await anon().post("/public/admission", goodApplication(w.cls.id));
    const coord = await loginAs(w.coordinator.email);
    const id = (await coord.get("/site/applications")).body.items[0].id;
    expect((await coord.post(`/site/applications/${id}/reject`, { reviewNote: "No seats" })).status).toBe(204);
    expect((await coord.post(`/site/applications/${id}/reject`, {})).status).toBe(409);
    const teacher = await loginAs(w.teacherUser.email);
    expect((await teacher.get("/site/applications")).status).toBe(403);
  });
});

describe("website teachers and gallery (admin)", () => {
  it("edits a teacher's public profile and rejects unsafe photo URLs", async () => {
    const admin = await loginAs(w.admin.email);
    const ok = await admin.patch(`/site/teachers/${w.teacher.id}`, { showOnWebsite: true, bio: "10 years teaching", websiteOrder: 2 });
    expect(ok.status).toBe(200);
    expect(ok.body.teacher).toMatchObject({ showOnWebsite: true, bio: "10 years teaching", name: "Tina Teacher" });
    expect((await admin.patch(`/site/teachers/${w.teacher.id}`, { photoUrl: "data:text/html,x" })).status).toBe(400);
    expect((await admin.patch("/site/teachers/nope", { showOnWebsite: true })).status).toBe(404);
  });

  it("gallery CRUD with soft delete; public gallery shows only live images", async () => {
    const admin = await loginAs(w.admin.email);
    const a = (await admin.post("/site/gallery", { url: "/uploads/a.jpg", caption: "Sports day" })).body.image;
    await admin.post("/site/gallery", { url: "https://cdn.example.com/b.jpg" });
    expect((await admin.post("/site/gallery", { url: "javascript:x" })).status).toBe(400);
    expect((await admin.patch(`/site/gallery/${a.id}`, { caption: "Annual sports day" })).body.image.caption).toBe("Annual sports day");
    expect((await anon().get("/public/gallery")).body.items).toHaveLength(2);
    expect((await admin.del(`/site/gallery/${a.id}`)).status).toBe(204);
    expect((await anon().get("/public/gallery")).body.items).toHaveLength(1);
    expect((await admin.del(`/site/gallery/${a.id}`)).status).toBe(404);
  });
});
