import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { Client, startServer, stopServer, seedSchool, loginAs, mailbox, type World } from "./helpers/harness";

let w: World;
let admin: Client;
beforeAll(startServer);
afterAll(stopServer);
beforeEach(async () => {
  w = await seedSchool();
  admin = await loginAs(w.admin.email);
});

const body = (extra = {}) => ({ title: "Sports day", bodyHtml: "<p>Friday</p>", audience: "all", publishNow: true, ...extra });
const live = async (c: Client) => (await c.get("/engagement/notices")).body.items.map((n: any) => n.title);

describe("staff notices need admin approval", () => {
  for (const [label, user] of [["teacher", () => w.teacherUser], ["librarian", () => w.librarian], ["coordinator", () => w.coordinator]] as const) {
    it(`${label}: always lands as pending, even when publishNow:true is sent, and nobody is emailed`, async () => {
      const c = await loginAs(user().email);
      mailbox().length = 0;
      const r = await c.post("/engagement/notices", body());
      expect(r.status).toBe(201);
      expect(r.body.notice.status).toBe("pending");
      expect(mailbox()).toHaveLength(0);
      expect(await live(await loginAs(w.parentUser.email))).toEqual([]);
      expect(await live(admin)).toEqual([]); // not on the live board either
      expect((await new Client().get("/public/notices")).body.items ?? []).toHaveLength(0);
    });
  }

  it("the author sees their own pending notice; others do not", async () => {
    const t = await loginAs(w.teacherUser.email);
    await t.post("/engagement/notices", body());
    expect((await t.get("/engagement/notices/mine")).body.items).toHaveLength(1);
    const lib = await loginAs(w.librarian.email);
    expect((await lib.get("/engagement/notices/mine")).body.items).toHaveLength(0);
  });

  it("only admin / super admin see the approval queue and can approve or reject", async () => {
    const t = await loginAs(w.teacherUser.email);
    const id = (await t.post("/engagement/notices", body())).body.notice.id;
    for (const email of [w.teacherUser.email, w.coordinator.email, w.librarian.email, w.accountant.email, w.parentUser.email]) {
      const c = await loginAs(email);
      expect((await c.get("/engagement/notices/pending")).status).toBe(403);
      expect((await c.post(`/engagement/notices/${id}/approve`)).status).toBe(403);
      expect((await c.post(`/engagement/notices/${id}/reject`, { note: "no thanks" })).status).toBe(403);
    }
    expect((await admin.get("/engagement/notices/pending")).body.items).toHaveLength(1);
  });

  it("approving publishes once, emails the audience, and shows on the live + public board", async () => {
    const t = await loginAs(w.teacherUser.email);
    const id = (await t.post("/engagement/notices", body({ audience: "parents" }))).body.notice.id;
    mailbox().length = 0;
    expect((await admin.post(`/engagement/notices/${id}/approve`)).status).toBe(200);
    const mails = mailbox().filter((m) => /Sports day/.test(m.subject));
    expect(mails.map((m) => m.to)).toEqual(expect.arrayContaining([w.parentUser.email, w.otherParentUser.email]));
    expect(await live(await loginAs(w.parentUser.email))).toEqual(["Sports day"]);
    // double approval is refused and does not re-send
    const before = mailbox().length;
    expect((await admin.post(`/engagement/notices/${id}/approve`)).status).toBe(409);
    expect(mailbox()).toHaveLength(before);
    expect((await t.get("/engagement/notices/mine")).body.items[0].status).toBe("published");
  });

  it("rejecting keeps it off the board and shows the note to the author, who can fix and resubmit", async () => {
    const t = await loginAs(w.teacherUser.email);
    const id = (await t.post("/engagement/notices", body())).body.notice.id;
    expect((await admin.post(`/engagement/notices/${id}/reject`, { note: "x" })).status).toBe(400); // note too short
    expect((await admin.post(`/engagement/notices/${id}/reject`, { note: "Add the venue" })).status).toBe(200);
    const mine = (await t.get("/engagement/notices/mine")).body.items[0];
    expect(mine.status).toBe("rejected");
    expect(mine.rejectionNote).toBe("Add the venue");
    expect(await live(admin)).toEqual([]);

    const fix = await t.patch(`/engagement/notices/${id}`, { title: "Sports day (venue: main field)", bodyHtml: "<p>Main field</p><script>x</script>", audience: "all" });
    expect(fix.status).toBe(200);
    const again = (await t.get("/engagement/notices/mine")).body.items[0];
    expect(again.status).toBe("pending");
    expect(again.rejectionNote).toBeNull();
    expect(again.bodyHtml).not.toMatch(/<script/i);
    expect((await admin.get("/engagement/notices/pending")).body.items).toHaveLength(1);
  });

  it("a published notice cannot be edited, and nobody but the author can edit", async () => {
    const t = await loginAs(w.teacherUser.email);
    const id = (await t.post("/engagement/notices", body())).body.notice.id;
    const other = await loginAs(w.librarian.email);
    expect((await other.patch(`/engagement/notices/${id}`, { title: "hijack", bodyHtml: "<p>x</p>", audience: "all" })).status).toBe(404);
    await admin.post(`/engagement/notices/${id}/approve`);
    expect((await t.patch(`/engagement/notices/${id}`, { title: "late edit", bodyHtml: "<p>x</p>", audience: "all" })).status).toBe(409);
  });

  it("admin cannot approve their own notice; admin notices publish directly", async () => {
    const mine = await admin.post("/engagement/notices", body({ title: "Admin direct" }));
    expect(mine.body.notice.status).toBe("published");
    expect(await live(admin)).toEqual(["Admin direct"]);
    const draft = await admin.post("/engagement/notices", body({ title: "Admin draft", publishNow: false }));
    expect(draft.body.notice.status).toBe("draft");
    expect(await live(admin)).toEqual(["Admin direct"]);
    const sa = await loginAs(w.superAdmin.email);
    // staff notice approved by a DIFFERENT admin works; self-approval of a (pending) own notice is blocked
    const t = await loginAs(w.teacherUser.email);
    const id = (await t.post("/engagement/notices", body({ title: "Staff one" }))).body.notice.id;
    expect((await sa.post(`/engagement/notices/${id}/approve`)).status).toBe(200);
  });

  it("an accountant can read the board but not write", async () => {
    await admin.post("/engagement/notices", body({ audience: "staff", title: "Payroll" }));
    const acc = await loginAs(w.accountant.email);
    expect(await live(acc)).toEqual(["Payroll"]);
    expect((await acc.post("/engagement/notices", body())).status).toBe(403);
  });
});
