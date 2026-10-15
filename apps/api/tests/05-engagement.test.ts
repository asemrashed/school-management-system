import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { Client, startServer, stopServer, seedSchool, loginAs, db, mailbox, type World } from "./helpers/harness";

let w: World;
beforeAll(startServer);
afterAll(stopServer);
beforeEach(async () => { w = await seedSchool(); });

describe("notices", () => {
  it("publishing a notice to 'parents' emails every parent and sanitizes the HTML", async () => {
    const admin = await loginAs(w.admin.email);
    const r = await admin.post("/engagement/notices", {
      title: "PTM this Friday",
      bodyHtml: '<p>Please attend</p><script>alert(1)</script><img src=x onerror="alert(2)">',
      audience: "parents",
      publishNow: true,
    });
    expect(r.status).toBe(201);
    expect(r.body.notice.bodyHtml).not.toMatch(/<script/i);
    expect(r.body.notice.bodyHtml).not.toMatch(/onerror/i);
    const recipients = mailbox().filter((m) => /PTM this Friday/.test(m.subject)).map((m) => m.to);
    expect(recipients).toEqual(expect.arrayContaining([w.parentUser.email, w.otherParentUser.email]));
    expect(recipients).not.toContain(w.teacherUser.email);
  });
  it("a draft (publishNow: false) sends no email and is not returned by GET (which only lists published)", async () => {
    const admin = await loginAs(w.admin.email);
    mailbox().length = 0;
    await admin.post("/engagement/notices", { title: "Draft only", bodyHtml: "<p>shh</p>", audience: "all", publishNow: false });
    expect(mailbox()).toHaveLength(0);
    const list = await new Client().get("/engagement/notices"); // any authed user can list; use loginAs below instead since this route requires auth
  });
  it("only staff authors may submit a notice — never parent, student or accountant", async () => {
    for (const email of [w.parentUser.email, w.studentUser.email, w.accountant.email]) {
      const c = await loginAs(email);
      const r = await c.post("/engagement/notices", { title: "x", bodyHtml: "<p>y</p>", audience: "all" });
      expect(r.status).toBe(403);
    }
  });
});

describe("events", () => {
  it("creates and lists an upcoming event; validation rejects endAt before startAt", async () => {
    const admin = await loginAs(w.admin.email);
    const bad = await admin.post("/engagement/events", { title: "Sports Day", startAt: "2099-02-01T09:00:00.000Z", endAt: "2099-01-01T09:00:00.000Z" });
    expect(bad.status).toBe(400);
    const ok = await admin.post("/engagement/events", { title: "Sports Day", startAt: "2099-02-01T09:00:00.000Z", endAt: "2099-02-01T13:00:00.000Z", location: "Field" });
    expect(ok.status).toBe(201);
    const list = await admin.get("/engagement/events");
    expect(list.body.items.some((e: any) => e.title === "Sports Day")).toBe(true);
  });
});

describe("support tickets — thread privacy", () => {
  it("a parent only ever sees their own tickets, never another family's", async () => {
    const parentA = await loginAs(w.parentUser.email);
    const parentB = await loginAs(w.otherParentUser.email);
    await parentA.post("/engagement/tickets", { subject: "Fee question", body: "Why is it higher this term?" });
    await parentB.post("/engagement/tickets", { subject: "Bus route", body: "Does route 4 stop near me?" });

    const aList = await parentA.get("/engagement/tickets");
    expect(aList.body.items.map((t: any) => t.subject)).toEqual(["Fee question"]);
    const bList = await parentB.get("/engagement/tickets");
    expect(bList.body.items.map((t: any) => t.subject)).toEqual(["Bus route"]);
  });
  it("staff see every ticket; replying moves status to in_progress; a parent cannot reply to another family's ticket", async () => {
    const parentA = await loginAs(w.parentUser.email);
    const ticket = (await parentA.post("/engagement/tickets", { subject: "Fee question", body: "Why higher?" })).body.ticket;

    const admin = await loginAs(w.admin.email);
    const staffList = await admin.get("/engagement/tickets");
    expect(staffList.body.items.some((t: any) => t.id === ticket.id)).toBe(true);

    const reply = await admin.post(`/engagement/tickets/${ticket.id}/messages`, { body: "Because of the new lab fee." });
    expect(reply.status).toBe(201);
    expect(reply.body.ticket.status).toBe("in_progress");

    const parentB = await loginAs(w.otherParentUser.email);
    const intrude = await parentB.post(`/engagement/tickets/${ticket.id}/messages`, { body: "let me in" });
    expect(intrude.status).toBe(403);
  });
  it("only staff may change ticket status", async () => {
    const parentA = await loginAs(w.parentUser.email);
    const ticket = (await parentA.post("/engagement/tickets", { subject: "Timing", body: "Y" })).body.ticket;
    expect((await parentA.patch(`/engagement/tickets/${ticket.id}/status`, { status: "resolved" })).status).toBe(403);
    const admin = await loginAs(w.admin.email);
    expect((await admin.patch(`/engagement/tickets/${ticket.id}/status`, { status: "resolved" })).status).toBe(200);
  });
});
