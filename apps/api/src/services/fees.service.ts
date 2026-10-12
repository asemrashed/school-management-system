import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { notify } from "./notification.service";

function computeStatus(amountDue: number, amountPaid: number, dueDate: Date): "unpaid" | "partial" | "paid" | "overdue" {
  if (amountPaid >= amountDue) return "paid";
  if (amountPaid > 0) return "partial";
  if (dueDate < new Date()) return "overdue";
  return "unpaid";
}

export async function createInvoice(input: {
  studentId: string;
  feeStructureId: string;
  term: string;
  dueDate: string;
}) {
  const feeStructure = await prisma.feeStructure.findUnique({ where: { id: input.feeStructureId } });
  if (!feeStructure) throw AppError.badRequest("FEE_STRUCTURE_NOT_FOUND", "That fee structure does not exist.");

  const student = await prisma.student.findUnique({
    where: { id: input.studentId },
    include: { user: true, guardian: { include: { user: true } } },
  });
  if (!student) throw AppError.badRequest("STUDENT_NOT_FOUND", "That student does not exist.");

  const dueDate = new Date(input.dueDate);
  const invoice = await prisma.invoice.create({
    data: {
      studentId: input.studentId,
      feeStructureId: input.feeStructureId,
      term: input.term,
      amountDue: feeStructure.amount,
      dueDate,
      status: computeStatus(feeStructure.amount, 0, dueDate),
    },
    include: { student: { include: { user: true } }, feeStructure: true },
  });

  if (student.guardian) {
    await notify({
      category: "fee_due",
      recipientEmail: student.guardian.user.email,
      recipientPhone: student.guardian.phone,
      subject: `New invoice for ${student.user.name}`,
      html: `<p>A new invoice of ৳${(feeStructure.amount / 100).toFixed(2)} (${feeStructure.name}, ${input.term}) is due on ${input.dueDate}.</p>`,
      smsBody: `New invoice of ৳${(feeStructure.amount / 100).toFixed(2)} due ${input.dueDate} for ${student.user.name}.`,
    });
  }

  return invoice;
}

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * The one place an invoice balance changes. Runs inside the caller's
 * transaction; the optimistic `amountPaid` check means two concurrent
 * payments can never jointly overpay an invoice.
 */
export async function applyPayment(
  tx: TxClient,
  input: { invoiceId: string; amount: number; method: "cash" | "bkash" | "nagad" | "sslcommerz"; transactionRef?: string | null }
) {
  if (input.amount <= 0) throw AppError.badRequest("INVALID_AMOUNT", "Payment amount must be greater than zero.");

  const invoice = await tx.invoice.findUnique({ where: { id: input.invoiceId } });
  if (!invoice) throw AppError.notFound("Invoice not found.");

  const outstanding = invoice.amountDue - invoice.amountPaid;
  if (outstanding <= 0) throw AppError.conflict("This invoice is already fully paid.");
  if (input.amount > outstanding) {
    throw AppError.badRequest(
      "OVERPAYMENT",
      `Payment exceeds the outstanding balance of ৳${(outstanding / 100).toFixed(2)}.`,
      { outstanding }
    );
  }

  const newAmountPaid = invoice.amountPaid + input.amount;
  const updated = await tx.invoice.updateMany({
    where: { id: invoice.id, amountPaid: invoice.amountPaid },
    data: { amountPaid: newAmountPaid, status: computeStatus(invoice.amountDue, newAmountPaid, invoice.dueDate) },
  });
  if (updated.count !== 1) {
    throw AppError.conflict("This invoice was just updated by someone else. Please refresh and retry.");
  }

  return tx.payment.create({
    data: {
      invoiceId: input.invoiceId,
      amount: input.amount,
      method: input.method,
      transactionRef: input.transactionRef ?? undefined,
    },
  });
}

export async function recordPayment(input: {
  invoiceId: string;
  amount: number;
  method: "cash" | "bkash" | "nagad" | "sslcommerz";
  transactionRef?: string;
}) {
  return prisma.$transaction((tx) => applyPayment(tx, input));
}

// --- Online payments ---------------------------------------------------------

/**
 * Called when a gateway (or the sandbox checkout) confirms the money moved.
 * Idempotent: the `pending -> succeeded` flip is a compare-and-set, so a
 * replayed callback finds nothing to do and never pays the invoice twice.
 */
export async function confirmOnlinePayment(sessionRef: string, transactionRef: string | null) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.onlinePayment.findUnique({ where: { gatewaySessionId: sessionRef } });
    if (!session) throw AppError.notFound("Payment session not found.");
    if (session.status !== "pending") return { alreadyProcessed: true as const, session };

    const claimed = await tx.onlinePayment.updateMany({
      where: { id: session.id, status: "pending" },
      data: { status: "succeeded" },
    });
    if (claimed.count !== 1) return { alreadyProcessed: true as const, session };

    // The invoice may have been paid at the office while the user was on the
    // gateway page; pay only what is still owed (never more than was taken).
    const invoice = await tx.invoice.findUnique({ where: { id: session.invoiceId } });
    const outstanding = invoice ? invoice.amountDue - invoice.amountPaid : 0;
    const amount = Math.min(session.amount, outstanding);
    if (amount <= 0) {
      await tx.onlinePayment.update({ where: { id: session.id }, data: { status: "failed" } });
      throw AppError.conflict("This invoice was already paid; the online payment was not applied. Contact the school office for a refund.");
    }
    const payment = await applyPayment(tx, {
      invoiceId: session.invoiceId,
      amount,
      method: session.method,
      transactionRef,
    });
    const updated = await tx.onlinePayment.update({ where: { id: session.id }, data: { paymentId: payment.id } });
    return { alreadyProcessed: false as const, session: updated, payment };
  });
}

export async function failOnlinePayment(sessionRef: string) {
  await prisma.onlinePayment.updateMany({ where: { gatewaySessionId: sessionRef, status: "pending" }, data: { status: "failed" } });
}

// --- Bulk invoice generation ("add this month's fee") ----------------------------

export async function generateInvoices(input: {
  feeStructureId: string;
  term: string;
  dueDate: string;
  sectionId?: string;
}) {
  const structure = await prisma.feeStructure.findFirst({ where: { id: input.feeStructureId, deletedAt: null } });
  if (!structure) throw AppError.badRequest("FEE_STRUCTURE_NOT_FOUND", "That fee structure does not exist.");

  const students = await prisma.student.findMany({
    where: {
      deletedAt: null,
      user: { isActive: true, deletedAt: null },
      section: { classId: structure.classId, deletedAt: null, ...(input.sectionId ? { id: input.sectionId } : {}) },
    },
    include: { user: true, guardian: { include: { user: true } } },
  });

  const dueDate = new Date(input.dueDate);
  const existing = await prisma.invoice.findMany({
    where: { feeStructureId: structure.id, term: input.term, studentId: { in: students.map((s) => s.id) } },
  });
  const billed = new Set(existing.map((i) => i.studentId));

  let created = 0;
  const notifyList: typeof students = [];
  for (const student of students) {
    if (billed.has(student.id)) continue;
    await prisma.invoice.create({
      data: {
        studentId: student.id,
        feeStructureId: structure.id,
        term: input.term,
        amountDue: structure.amount,
        dueDate,
        status: computeStatus(structure.amount, 0, dueDate),
      },
    });
    created++;
    notifyList.push(student);
  }

  // One message per guardian, not per invoice, so a family with three
  // children gets a single reminder per run.
  const seen = new Set<string>();
  for (const s of notifyList) {
    if (!s.guardian || seen.has(s.guardian.id)) continue;
    seen.add(s.guardian.id);
    await notify({
      category: "fee_due",
      recipientEmail: s.guardian.user.email,
      recipientPhone: s.guardian.phone,
      subject: `${structure.name} for ${input.term}`,
      html: `<p>${structure.name} (${input.term}) of ৳${(structure.amount / 100).toFixed(2)} per child is due on ${input.dueDate}. Pay online from the school portal.</p>`,
      smsBody: `${structure.name} ${input.term}: ৳${(structure.amount / 100).toFixed(2)} due ${input.dueDate}.`,
    });
  }

  return { created, skipped: students.length - created };
}

/** Recomputes overdue status for invoices whose due date has passed —
 * intended to run on a schedule (see devops.md for future cron wiring). */
export async function refreshOverdueInvoices() {
  await prisma.invoice.updateMany({
    where: { status: "unpaid", dueDate: { lt: new Date() } },
    data: { status: "overdue" },
  });
}
