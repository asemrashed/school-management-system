import { Router } from "express";
import { asyncHandler } from "../lib/errors";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import * as c from "../controllers/exam-sessions.controller";

export const examSessionsRouter = Router();
examSessionsRouter.use(requireAuth);

const ADMIN = ["super_admin", "admin", "coordinator"] as const;

// Student / parent report cards (declared before "/:id" so "mine" is not read as an id).
examSessionsRouter.get("/mine", requireRole("student", "parent"), asyncHandler(c.myResults));

examSessionsRouter.get("/", requireRole(...ADMIN, "teacher"), asyncHandler(c.listSessions));
examSessionsRouter.post("/", requireRole(...ADMIN), asyncHandler(c.createSession));
examSessionsRouter.get("/:id/progress", requireRole(...ADMIN), asyncHandler(c.sessionProgress));
examSessionsRouter.get("/:id/results", requireRole(...ADMIN, "teacher"), asyncHandler(c.resultSheet));
examSessionsRouter.delete("/:id", requireRole(...ADMIN), asyncHandler(c.deleteSession));
