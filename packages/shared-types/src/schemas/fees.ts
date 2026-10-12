import { z } from "zod";

// Money is always an integer number of paisa (db-schema.md, erp-domain.md).
const paisaAmount = z.number().int().nonnegative();

export const feeStructureDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  classId: z.string(),
  className: z.string(),
  shiftId: z.string(),
  year: z.number().int(),
  amount: paisaAmount,
  kind: z.enum(["admission", "monthly", "other"]),
});
export type FeeStructureDto = z.infer<typeof feeStructureDtoSchema>;

export const createFeeStructureSchema = z.object({
  name: z.string().min(1).max(80),
  classId: z.string(),
  /** Optional: defaults to the class's own shift. */
  shiftId: z.string().optional(),
  year: z.number().int().min(2000).max(2100),
  amount: paisaAmount,
  kind: z.enum(["admission", "monthly", "other"]).default("other"),
});
export const updateFeeStructureSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  amount: paisaAmount.optional(),
  kind: z.enum(["admission", "monthly", "other"]).optional(),
});
export type UpdateFeeStructureInput = z.infer<typeof updateFeeStructureSchema>;
export type CreateFeeStructureInput = z.infer<typeof createFeeStructureSchema>;

export const invoiceStatusSchema = z.enum(["unpaid", "partial", "paid", "overdue"]);
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;

export const invoiceDtoSchema = z.object({
  id: z.string(),
  studentId: z.string(),
  studentName: z.string(),
  feeStructureId: z.string(),
  feeStructureName: z.string(),
  term: z.string(),
  amountDue: paisaAmount,
  amountPaid: paisaAmount,
  status: invoiceStatusSchema,
  dueDate: z.string(),
});
export type InvoiceDto = z.infer<typeof invoiceDtoSchema>;

export const createInvoiceSchema = z.object({
  studentId: z.string(),
  feeStructureId: z.string(),
  term: z.string().min(1).max(40),
  dueDate: z.string().date(),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const PAYMENT_METHODS = ["cash", "bkash", "nagad", "sslcommerz"] as const;
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const recordPaymentSchema = z.object({
  invoiceId: z.string(),
  amount: paisaAmount,
  method: paymentMethodSchema,
  transactionRef: z.string().optional(),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const paymentDtoSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  amount: paisaAmount,
  method: paymentMethodSchema,
  transactionRef: z.string().nullable(),
  paidAt: z.string(),
});
export type PaymentDto = z.infer<typeof paymentDtoSchema>;

/** Online gateways (bKash/Nagad/SSLCommerz) are wired via a provider
 * factory (packages/config), same pattern as storage/messaging. This just
 * asks the API to start a session; the actual redirect URL comes from the
 * gateway once a real SDK is plugged in. */
export const initiateOnlinePaymentSchema = z.object({
  invoiceId: z.string(),
  method: z.enum(["bkash", "nagad", "sslcommerz"]),
});

/**
 * Bulk "add this month's fee": raises one invoice per active student for the
 * chosen fee structure. Safe to re-run — a student who already has an invoice
 * for the same structure and term is skipped, never billed twice.
 */
export const generateInvoicesSchema = z.object({
  feeStructureId: z.string().min(1),
  /** Billing period label, e.g. "2026-10" for monthly fees. */
  term: z.string().trim().min(1).max(40),
  dueDate: z.string().date(),
  /** Narrow to one section; omitted = every section of the structure's class. */
  sectionId: z.string().min(1).optional(),
});
export type GenerateInvoicesInput = z.infer<typeof generateInvoicesSchema>;

export const generateInvoicesResultSchema = z.object({
  created: z.number().int(),
  skipped: z.number().int(),
});
export type GenerateInvoicesResult = z.infer<typeof generateInvoicesResultSchema>;

export const onlinePaymentSessionSchema = z.object({
  redirectUrl: z.string(),
  gatewaySessionId: z.string(),
});
export type OnlinePaymentSession = z.infer<typeof onlinePaymentSessionSchema>;

export const paymentOptionsSchema = z.object({
  methods: z.array(z.enum(["bkash", "nagad", "sslcommerz"])),
  sandbox: z.boolean(),
});
export type PaymentOptions = z.infer<typeof paymentOptionsSchema>;
