import type { Request, Response } from "express";
import {
  createFeeStructureSchema,
  createInvoiceSchema,
  recordPaymentSchema,
  initiateOnlinePaymentSchema,
  generateInvoicesSchema,
  updateFeeStructureSchema,
  type FeeStructureDto,
  type InvoiceDto,
} from "@packages/shared-types";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { createPaymentProvider, GatewayNotWiredError } from "@packages/config";
import crypto from "node:crypto";
import { env } from "../lib/providers";
import { isGuardianRole, ownStudentIds } from "../lib/scope";
import * as feesService from "../services/fees.service";

const paymentProvider = createPaymentProvider(env);

// --- Fee structures ---

export async function listFeeStructures(_req: Request, res: Response) {
  const rows = await prisma.feeStructure.findMany({
    where: { deletedAt: null },
    include: { class: true },
    orderBy: { createdAt: "desc" },
  });
  const items: FeeStructureDto[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    classId: r.classId,
    className: r.class.name,
    shiftId: r.shiftId,
    year: r.year,
    amount: r.amount,
    kind: r.kind,
  }));
  res.json({ items });
}

export async function createFeeStructure(req: Request, res: Response) {
  const input = createFeeStructureSchema.parse(req.body);
  const cls = await prisma.class.findFirst({ where: { id: input.classId, deletedAt: null } });
  if (!cls) throw AppError.badRequest("CLASS_NOT_FOUND", "Choose a class from the list.");
  const row = await prisma.feeStructure.create({
    data: { ...input, shiftId: input.shiftId ?? cls.shiftId },
    include: { class: true },
  });
  res.status(201).json({
    feeStructure: {
      id: row.id,
      name: row.name,
      classId: row.classId,
      className: row.class.name,
      shiftId: row.shiftId,
      year: row.year,
      amount: row.amount,
      kind: row.kind,
    },
  });
}

export async function updateFeeStructure(req: Request, res: Response) {
  const input = updateFeeStructureSchema.parse(req.body);
  const existing = await prisma.feeStructure.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!existing) throw AppError.notFound("Fee structure not found.");
  // Changing the amount only affects invoices raised from now on; existing
  // invoices keep the amount they were billed at.
  const row = await prisma.feeStructure.update({ where: { id: existing.id }, data: input, include: { class: true } });
  res.json({
    feeStructure: {
      id: row.id, name: row.name, classId: row.classId, className: row.class.name,
      shiftId: row.shiftId, year: row.year, amount: row.amount, kind: row.kind,
    },
  });
}

export async function deleteFeeStructure(req: Request, res: Response) {
  const existing = await prisma.feeStructure.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!existing) throw AppError.notFound("Fee structure not found.");
  await prisma.feeStructure.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
  res.status(204).send();
}

// --- Invoices ---

function toInvoiceDto(row: {
  id: string;
  studentId: string;
  student: { user: { name: string } };
  feeStructureId: string;
  feeStructure: { name: string };
  term: string;
  amountDue: number;
  amountPaid: number;
  status: string;
  dueDate: Date;
}): InvoiceDto {
  return {
    id: row.id,
    studentId: row.studentId,
    studentName: row.student.user.name,
    feeStructureId: row.feeStructureId,
    feeStructureName: row.feeStructure.name,
    term: row.term,
    amountDue: row.amountDue,
    amountPaid: row.amountPaid,
    status: row.status as InvoiceDto["status"],
    dueDate: row.dueDate.toISOString().slice(0, 10),
  };
}

export async function listInvoices(req: Request, res: Response) {
  const studentId = typeof req.query.studentId === "string" ? req.query.studentId : undefined;

  // Parents/students only ever see their own invoices — enforced here, not
  // just hidden in the UI (auth-rbac-matrix.md: "client NEVER receives
  // other users' ... data"). An account with no linked student sees nothing
  // rather than everything.
  let where: { studentId?: string | { in: string[] } } | undefined = studentId ? { studentId } : undefined;
  if (isGuardianRole(req.user!)) {
    const ownIds = await ownStudentIds(req.user!);
    if (studentId && !ownIds.includes(studentId)) throw AppError.forbidden();
    where = { studentId: studentId ?? { in: ownIds } };
  }

  const rows = await prisma.invoice.findMany({
    where,
    include: { student: { include: { user: true } }, feeStructure: true },
    orderBy: { dueDate: "desc" },
  });
  res.json({ items: rows.map(toInvoiceDto) });
}

export async function createInvoice(req: Request, res: Response) {
  const input = createInvoiceSchema.parse(req.body);
  const invoice = await feesService.createInvoice(input);
  res.status(201).json({ invoice: toInvoiceDto(invoice as any) });
}

// --- Payments ---

export async function recordPayment(req: Request, res: Response) {
  const input = recordPaymentSchema.parse(req.body);
  const payment = await feesService.recordPayment(input);
  res.status(201).json({ payment });
}

export async function generateInvoices(req: Request, res: Response) {
  const input = generateInvoicesSchema.parse(req.body);
  res.status(201).json(await feesService.generateInvoices(input));
}

/** Which online methods the UI may offer, and whether checkout is the fake sandbox. */
export async function paymentOptions(_req: Request, res: Response) {
  res.json({ methods: paymentProvider.enabledMethods(), sandbox: paymentProvider.sandbox });
}

/** Everything a printable receipt needs, scoped like invoices are. */
export async function getReceipt(req: Request, res: Response) {
  const payment = await prisma.payment.findUnique({
    where: { id: req.params.id },
    include: { invoice: { include: { student: { include: { user: true } }, feeStructure: true } } },
  });
  if (!payment) throw AppError.notFound("Receipt not found.");
  if (isGuardianRole(req.user!)) {
    const ownIds = await ownStudentIds(req.user!);
    if (!ownIds.includes(payment.invoice.studentId)) throw AppError.notFound("Receipt not found.");
  } else if (!["super_admin", "admin", "accountant"].includes(req.user!.role)) {
    throw AppError.forbidden();
  }
  const school = await prisma.school.findFirst({ where: { deletedAt: null } });
  res.json({
    receipt: {
      receiptNo: payment.id.slice(-8).toUpperCase(),
      schoolName: school?.name ?? "School",
      studentName: payment.invoice.student.user.name,
      studentCode: payment.invoice.student.studentCode,
      feeName: payment.invoice.feeStructure.name,
      term: payment.invoice.term,
      amount: payment.amount,
      method: payment.method,
      transactionRef: payment.transactionRef,
      paidAt: payment.paidAt.toISOString(),
      balanceAfter: payment.invoice.amountDue - payment.invoice.amountPaid,
    },
  });
}

export async function listInvoicePayments(req: Request, res: Response) {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!invoice) throw AppError.notFound("Invoice not found.");
  if (isGuardianRole(req.user!)) {
    const ownIds = await ownStudentIds(req.user!);
    if (!ownIds.includes(invoice.studentId)) throw AppError.notFound("Invoice not found.");
  }
  const rows = await prisma.payment.findMany({ where: { invoiceId: invoice.id }, orderBy: { paidAt: "desc" } });
  res.json({
    items: rows.map((p) => ({
      id: p.id, invoiceId: p.invoiceId, amount: p.amount, method: p.method,
      transactionRef: p.transactionRef, paidAt: p.paidAt.toISOString(),
    })),
  });
}

/** Sandbox checkout page -> "I paid" / "cancel". Only exists in sandbox mode. */
export async function completeSandboxPayment(req: Request, res: Response) {
  if (!paymentProvider.sandbox) throw AppError.notFound();
  const outcome = req.body?.outcome === "fail" ? "fail" : "success";
  const session = await prisma.onlinePayment.findUnique({
    where: { gatewaySessionId: req.params.session },
    include: { invoice: true },
  });
  if (!session) throw AppError.notFound("Payment session not found.");
  // Same ownership rule as starting the payment: the person who started it (or finance staff).
  if (isGuardianRole(req.user!)) {
    const ownIds = await ownStudentIds(req.user!);
    if (!ownIds.includes(session.invoice.studentId)) throw AppError.notFound("Payment session not found.");
  }
  if (outcome === "fail") {
    await feesService.failOnlinePayment(session.gatewaySessionId);
    res.json({ status: "failed" });
    return;
  }
  const result = await feesService.confirmOnlinePayment(session.gatewaySessionId, `SANDBOX-${session.id.slice(-6).toUpperCase()}`);
  res.json({ status: "succeeded", alreadyProcessed: result.alreadyProcessed });
}

/** SSLCommerz success/IPN callback (form-encoded, no session cookie). The
 * money is confirmed server-to-server with the gateway, never from this body. */
export async function sslcommerzCallback(req: Request, res: Response) {
  const tranId = typeof req.body?.tran_id === "string" ? req.body.tran_id : "";
  const valId = typeof req.body?.val_id === "string" ? req.body.val_id : "";
  const session = tranId ? await prisma.onlinePayment.findUnique({ where: { gatewaySessionId: tranId } }) : null;
  const back = env.PUBLIC_WEB_URL;
  // In sandbox mode there is no real gateway to verify against, so this public
  // endpoint must not be able to book money; the authenticated sandbox page does that.
  if (paymentProvider.sandbox || !session || session.method !== "sslcommerz" || !valId) {
    res.redirect(303, `${back}/dashboard?payment=failed`);
    return;
  }
  const ok = await paymentProvider.verify("sslcommerz", { valId, expectedAmount: session.amount, sessionRef: tranId });
  if (!ok) {
    await feesService.failOnlinePayment(tranId);
    res.redirect(303, `${back}/dashboard?payment=failed`);
    return;
  }
  try {
    await feesService.confirmOnlinePayment(tranId, valId);
    res.redirect(303, `${back}/dashboard?payment=success`);
  } catch {
    res.redirect(303, `${back}/dashboard?payment=failed`);
  }
}

export async function initiateOnlinePayment(req: Request, res: Response) {
  const input = initiateOnlinePaymentSchema.parse(req.body);
  const invoice = await prisma.invoice.findUnique({ where: { id: input.invoiceId } });
  if (!invoice) throw AppError.notFound("Invoice not found.");
  // Only the owner (or a finance role) may start a payment for an invoice.
  if (isGuardianRole(req.user!)) {
    const ownIds = await ownStudentIds(req.user!);
    if (!ownIds.includes(invoice.studentId)) throw AppError.notFound("Invoice not found.");
  }
  if (invoice.amountDue - invoice.amountPaid <= 0) {
    throw AppError.conflict("This invoice is already fully paid.");
  }

  if (!paymentProvider.isEnabled(input.method)) {
    throw AppError.badRequest(
      "PAYMENT_METHOD_DISABLED",
      `${input.method} is not enabled on this server yet. Ask your school to record this payment manually for now.`
    );
  }

  const outstanding = invoice.amountDue - invoice.amountPaid;
  // Abandoned checkouts must not pile up: close any older pending attempt first.
  await prisma.onlinePayment.updateMany({ where: { invoiceId: invoice.id, status: "pending" }, data: { status: "failed" } });
  const sessionRef = `SMS${Date.now().toString(36)}${crypto.randomBytes(6).toString("hex")}`.toUpperCase();
  await prisma.onlinePayment.create({
    data: { invoiceId: invoice.id, method: input.method, amount: outstanding, gatewaySessionId: sessionRef },
  });
  try {
    const session = await paymentProvider.initiate(input.method, { amount: outstanding, invoiceId: invoice.id, sessionRef });
    res.json(session);
  } catch (err) {
    await feesService.failOnlinePayment(sessionRef);
    if (err instanceof GatewayNotWiredError) {
      throw AppError.badRequest("PAYMENT_GATEWAY_UNAVAILABLE", err.message);
    }
    throw new AppError("PAYMENT_GATEWAY_ERROR", "The payment gateway could not be reached. Please try again shortly.", 502);
  }
}
