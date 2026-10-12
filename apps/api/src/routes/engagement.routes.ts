import { Router } from "express";
import { asyncHandler } from "../lib/errors";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import * as engagement from "../controllers/engagement.controller";

export const engagementRouter = Router();

engagementRouter.use(requireAuth);

engagementRouter.get("/notices", asyncHandler(engagement.listNotices));
engagementRouter.post(
  "/notices",
  requireRole("super_admin", "admin", "coordinator"),
  asyncHandler(engagement.createNotice)
);

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
