import { Router } from "express";
import { setRoleAccountLimitSchema } from "@packages/shared-types";
import { asyncHandler } from "../lib/errors";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { listRoleAccountLimits, setRoleAccountLimit } from "../services/role-limits.service";

/** Super Admin only: how many active accounts each role may have. */
export const roleLimitsRouter = Router();

roleLimitsRouter.use(requireAuth, requireRole("super_admin"));

roleLimitsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json({ items: await listRoleAccountLimits() });
  })
);

roleLimitsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = setRoleAccountLimitSchema.parse(req.body);
    await setRoleAccountLimit(input.role, input.maxAccounts);
    res.json({ items: await listRoleAccountLimits() });
  })
);
