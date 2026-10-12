import { Router } from "express";
import { asyncHandler } from "../lib/errors";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import * as library from "../controllers/library.controller";

export const libraryRouter = Router();

libraryRouter.use(requireAuth);

libraryRouter.get("/books", asyncHandler(library.listBooks));
libraryRouter.post(
  "/books",
  requireRole("super_admin", "admin", "librarian"),
  asyncHandler(library.createBook)
);

libraryRouter.get("/issues", asyncHandler(library.listIssues));
libraryRouter.post(
  "/issues",
  requireRole("super_admin", "admin", "librarian"),
  asyncHandler(library.issueBook)
);
libraryRouter.post(
  "/issues/return",
  requireRole("super_admin", "admin", "librarian"),
  asyncHandler(library.returnBook)
);

libraryRouter.get("/sales", requireRole("super_admin", "admin", "librarian"), asyncHandler(library.listSales));
libraryRouter.post(
  "/sales",
  requireRole("super_admin", "admin", "librarian"),
  asyncHandler(library.createSale)
);
