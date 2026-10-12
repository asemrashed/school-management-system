import { Router } from "express";
import { asyncHandler } from "../lib/errors";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import * as feesController from "../controllers/fees.controller";

export const feesRouter = Router();

feesRouter.use(requireAuth);

feesRouter.get(
  "/structures",
  requireRole("super_admin", "admin", "accountant"),
  asyncHandler(feesController.listFeeStructures)
);
feesRouter.post(
  "/structures",
  requireRole("super_admin", "admin", "accountant"),
  asyncHandler(feesController.createFeeStructure)
);

// Invoice listing is open to finance roles plus parent/student — the
// controller scopes parents/students to their own children/self.
feesRouter.get(
  "/invoices",
  requireRole("super_admin", "admin", "accountant", "parent", "student"),
  asyncHandler(feesController.listInvoices)
);
feesRouter.post(
  "/invoices",
  requireRole("super_admin", "admin", "accountant"),
  asyncHandler(feesController.createInvoice)
);

feesRouter.post(
  "/payments",
  requireRole("super_admin", "admin", "accountant"),
  asyncHandler(feesController.recordPayment)
);
feesRouter.post(
  "/payments/initiate",
  requireRole("super_admin", "admin", "accountant", "parent", "student"),
  asyncHandler(feesController.initiateOnlinePayment)
);

feesRouter.get(
  "/payments/options",
  requireRole("super_admin", "admin", "accountant", "parent", "student"),
  asyncHandler(feesController.paymentOptions)
);
feesRouter.post(
  "/payments/sandbox/:session/complete",
  requireRole("super_admin", "admin", "accountant", "parent", "student"),
  asyncHandler(feesController.completeSandboxPayment)
);
feesRouter.get(
  "/payments/:id/receipt",
  requireRole("super_admin", "admin", "accountant", "parent", "student"),
  asyncHandler(feesController.getReceipt)
);
feesRouter.get(
  "/invoices/:id/payments",
  requireRole("super_admin", "admin", "accountant", "parent", "student"),
  asyncHandler(feesController.listInvoicePayments)
);
feesRouter.post(
  "/invoices/generate",
  requireRole("super_admin", "admin", "accountant"),
  asyncHandler(feesController.generateInvoices)
);
feesRouter.patch(
  "/structures/:id",
  requireRole("super_admin", "admin", "accountant"),
  asyncHandler(feesController.updateFeeStructure)
);
feesRouter.delete(
  "/structures/:id",
  requireRole("super_admin", "admin", "accountant"),
  asyncHandler(feesController.deleteFeeStructure)
);
