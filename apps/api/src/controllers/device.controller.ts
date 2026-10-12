import type { Request, Response } from "express";
import { setDeviceLimitSchema, ROLES } from "@packages/shared-types";
import { prisma } from "../lib/prisma";
import { env } from "../lib/providers";

export async function listDeviceLimits(_req: Request, res: Response) {
  const rows = await prisma.deviceLimit.findMany();
  const byRole = new Map(rows.map((r) => [r.role, r.maxSessions]));
  res.json({
    deviceControlEnabled: env.DEVICE_CONTROL_ENABLED,
    items: ROLES.map((role) => ({ role, maxSessions: byRole.get(role) ?? null })),
  });
}

export async function setDeviceLimit(req: Request, res: Response) {
  const input = setDeviceLimitSchema.parse(req.body);
  const row = await prisma.deviceLimit.upsert({
    where: { role: input.role },
    update: { maxSessions: input.maxSessions },
    create: input,
  });
  res.json({ role: row.role, maxSessions: row.maxSessions });
}
