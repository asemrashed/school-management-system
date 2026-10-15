import { Router } from "express";
import { asyncHandler } from "../lib/errors";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import * as engagement from "../controllers/engagement.controller";

export const engagementRouter = Router();

engagementRouter.use(requireAuth);

engagementRouter.get("/notices", asyncHandler(engagement.listNotices));
const NOTICE_AUTHORS = ["super_admin", "admin", "coordinator", "teacher", "librarian"] as const;
engagementRouter.get("/notices/mine", requireRole(...NOTICE_AUTHORS), asyncHandler(engagement.listMyNotices));
engagementRouter.get("/notices/pending", requireRole("super_admin", "admin"), asyncHandler(engagement.listPendingNotices));
// Staff submit (always lands as "pending"); admin / super admin publish directly.
engagementRouter.post("/notices", requireRole(...NOTICE_AUTHORS), asyncHandler(engagement.createNotice));
engagementRouter.patch("/notices/:id", requireRole(...NOTICE_AUTHORS), asyncHandler(engagement.updateNotice));
engagementRouter.post("/notices/:id/approve", requireRole("super_admin", "admin"), asyncHandler(engagement.approveNotice));
engagementRouter.post("/notices/:id/reject", requireRole("super_admin", "admin"), asyncHandler(engagement.rejectNotice));

engagementRouter.get("/events", asyncHandler(engagement.listEvents));
engagementRouter.post(
  "/events",
  requireRole("super_admin", "admin", "coordinator"),
  asyncHandler(engagement.createEvent)
);

const TICKET_ROLES = ["super_admin", "admin", "coordinator", "parent"] as const;
engagementRouter.get("/tickets", requireRole(...TICKET_ROLES), asyncHandler(engagement.listTickets));
engagementRouter.post(
  "/tickets",
  requireRole("parent"),
  asyncHandler(engagement.createTicket)
);
engagementRouter.post(
  "/tickets/:id/messages",
  requireRole(...TICKET_ROLES),
  asyncHandler(engagement.addTicketMessage)
);
engagementRouter.patch(
  "/tickets/:id/status",
  requireRole("super_admin", "admin", "coordinator"),
  asyncHandler(engagement.updateTicketStatus)
);
