import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "../lib/errors";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import * as uploadsController from "../controllers/uploads.controller";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

export const uploadsRouter = Router();

// Only roles that actually attach files: teachers (resources), students
// (homework), and admin-tier staff (CMS media). Parents, accountants and
// librarians have no upload use-case, so they get no storage write access.
uploadsRouter.use(requireAuth, requireRole("super_admin", "admin", "coordinator", "teacher", "student"));
uploadsRouter.post("/", upload.single("file"), asyncHandler(uploadsController.uploadFile));
