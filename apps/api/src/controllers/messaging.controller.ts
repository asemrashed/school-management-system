import type { Request, Response } from "express";
import { updateMessagingFeatureToggleSchema } from "@packages/shared-types";
import { prisma } from "../lib/prisma";
import { env } from "../lib/providers";

export async function listToggles(_req: Request, res: Response) {
  const toggles = await prisma.messagingFeatureToggle.findMany({ orderBy: { category: "asc" } });
  res.json({
    smsGatewayEnabled: env.SMS_GATEWAY,
    items: toggles.map((t) => ({
      category: t.category,
      smsEnabled: t.smsEnabled,
      smsEligible: true,
    })),
  });
}

export async function updateToggle(req: Request, res: Response) {
  const input = updateMessagingFeatureToggleSchema.parse(req.body);
  const updated = await prisma.messagingFeatureToggle.update({
    where: { category: input.category },
    data: { smsEnabled: input.smsEnabled },
  });
  res.json({ category: updated.category, smsEnabled: updated.smsEnabled });
}
