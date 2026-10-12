import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";

// Must be set before the app module is imported (env is read once at load).
process.env.PAYMENT_SANDBOX = "true";

import { startServer, stopServer, seedSchool, loginAs, db, type World } from "./helpers/harness";

let w: World;
let base = "";
beforeAll(async () => { base = await startServer(); });
afterAll(stopServer);
beforeEach(async () => { w = await seedSchool(); });

const year = new Date().getFullYear();
async function invoice(studentId: string, amountDue = 250000) {
  const fee = await db().feeStructure.create({ data: { name: "Monthly Tuition", classId: w.cls.id, shiftId: w.shift.id, year, amount: amountDue, kind: "monthly" } });
  return db().invoice.create({ data: { studentId, feeStructureId: fee.id, term: "2026-10", amountDue, dueDate: new Date(Date.now() + 864e5) } });
}

describe("online payment, sandbox checkout", () => {
  it("offers all methods; parent pays an invoice end to end and gets a receipt", async () => {
    const parent = await loginAs(w.parentUser.email);
    const inv = await invoice(w.student.id);
    expect((await parent.get("/fees/payments/options")).body).toEqual({ methods: ["bkash", "nagad", "sslcommerz"], sandbox: true });

    const init = await parent.post("/fees/payments/initiate", { invoiceId: inv.id, method: "bkash" });
    expect(init.status).toBe(200);
    expect(init.body.redirectUrl).toContain("/pay/sandbox?session=");
    const ref = init.body.gatewaySessionId;
    expect(db().__rows("OnlinePayment")[0]).toMatchObject({ status: "pending", amount: 250000, method: "bkash" });
    expect(db().__rows("Payment")).toHaveLength(0); // nothing is booked until the gateway confirms

    const done = await parent.post(`/fees/payments/sandbox/${ref}/complete`, { outcome: "success" });
    expect(done.body.status).toBe("succeeded");
    expect(db().__rows("Invoice")[0]).toMatchObject({ amountPaid: 250000, status: "paid" });
    const pay = db().__rows("Payment")[0];
    expect(pay.method).toBe("bkash");

    const receipt = await parent.get(`/fees/payments/${pay.id}/receipt`);
    expect(receipt.body.receipt).toMatchObject({ studentName: "Sam Student", feeName: "Monthly Tuition", amount: 250000, balanceAfter: 0 });
    expect((await parent.get(`/fees/invoices/${inv.id}/payments`)).body.items).toHaveLength(1);
  });

  it("is idempotent: confirming twice (replayed callback) pays once", async () => {
    const parent = await loginAs(w.parentUser.email);
    const inv = await invoice(w.student.id);
    const ref = (await parent.post("/fees/payments/initiate", { invoiceId: inv.id, method: "nagad" })).body.gatewaySessionId;
    await parent.post(`/fees/payments/sandbox/${ref}/complete`, { outcome: "success" });
    const again = await parent.post(`/fees/payments/sandbox/${ref}/complete`, { outcome: "success" });
    expect(again.body.alreadyProcessed).toBe(true);
    expect(db().__rows("Payment")).toHaveLength(1);
    expect(db().__rows("Invoice")[0].amountPaid).toBe(250000);
  });

  it("a failed or cancelled checkout books nothing; a new attempt supersedes an abandoned one", async () => {
    const parent = await loginAs(w.parentUser.email);
    const inv = await invoice(w.student.id);
    const a = (await parent.post("/fees/payments/initiate", { invoiceId: inv.id, method: "bkash" })).body.gatewaySessionId;
    const b = (await parent.post("/fees/payments/initiate", { invoiceId: inv.id, method: "bkash" })).body.gatewaySessionId;
    const rows = db().__rows("OnlinePayment");
    expect(rows.find((r: any) => r.gatewaySessionId === a).status).toBe("failed");
    await parent.post(`/fees/payments/sandbox/${b}/complete`, { outcome: "fail" });
    expect(db().__rows("OnlinePayment").find((r: any) => r.gatewaySessionId === b).status).toBe("failed");
    expect(db().__rows("Payment")).toHaveLength(0);
    // a finished-failed session cannot be revived by a late "success"
    const late = await parent.post(`/fees/payments/sandbox/${b}/complete`, { outcome: "success" });
    expect(late.body.alreadyProcessed).toBe(true);
    expect(db().__rows("Payment")).toHaveLength(0);
  });

  it("only pays what is still owed when the office took part payment meanwhile", async () => {
    const parent = await loginAs(w.parentUser.email);
    const acc = await loginAs(w.accountant.email);
    const inv = await invoice(w.student.id);
    const ref = (await parent.post("/fees/payments/initiate", { invoiceId: inv.id, method: "bkash" })).body.gatewaySessionId;
    await acc.post("/fees/payments", { invoiceId: inv.id, amount: 100000, method: "cash" });
    await parent.post(`/fees/payments/sandbox/${ref}/complete`, { outcome: "success" });
    expect(db().__rows("Invoice")[0]).toMatchObject({ amountPaid: 250000, status: "paid" });
    expect(db().__rows("Payment").map((p: any) => p.amount).sort()).toEqual([100000, 150000]);
  });

  it("another family cannot pay, complete, or read receipts for someone else's invoice", async () => {
    const parent = await loginAs(w.parentUser.email);
    const other = await loginAs(w.otherParentUser.email);
    const inv = await invoice(w.student.id);
    expect((await other.post("/fees/payments/initiate", { invoiceId: inv.id, method: "bkash" })).status).toBe(404);
    const ref = (await parent.post("/fees/payments/initiate", { invoiceId: inv.id, method: "bkash" })).body.gatewaySessionId;
    expect((await other.post(`/fees/payments/sandbox/${ref}/complete`, { outcome: "success" })).status).toBe(404);
    await parent.post(`/fees/payments/sandbox/${ref}/complete`, { outcome: "success" });
    const payId = db().__rows("Payment")[0].id;
    expect((await other.get(`/fees/payments/${payId}/receipt`)).status).toBe(404);
    expect((await other.get(`/fees/invoices/${inv.id}/payments`)).status).toBe(404);
  });

  it("refuses to pay an already-paid invoice and rejects unknown sessions", async () => {
    const parent = await loginAs(w.parentUser.email);
    const acc = await loginAs(w.accountant.email);
    const inv = await invoice(w.student.id);
    await acc.post("/fees/payments", { invoiceId: inv.id, amount: 250000, method: "cash" });
    expect((await parent.post("/fees/payments/initiate", { invoiceId: inv.id, method: "bkash" })).status).toBe(409);
    expect((await parent.post("/fees/payments/sandbox/NOPE/complete", { outcome: "success" })).status).toBe(404);
  });

  it("the public SSLCommerz callback can never book money in sandbox mode", async () => {
    const parent = await loginAs(w.parentUser.email);
    const inv = await invoice(w.student.id);
    const ref = (await parent.post("/fees/payments/initiate", { invoiceId: inv.id, method: "sslcommerz" })).body.gatewaySessionId;
    // A forged gateway callback naming a real session and a made-up val_id.
    const res = await fetch(`${base}/fees/payments/callback/sslcommerz`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `tran_id=${ref}&val_id=FORGED&status=VALID`,
      redirect: "manual",
    });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("payment=failed");
    expect(db().__rows("Payment")).toHaveLength(0);
    expect(db().__rows("OnlinePayment").find((r: any) => r.gatewaySessionId === ref).status).toBe("pending");
  });
});
