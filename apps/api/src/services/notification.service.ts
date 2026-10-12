import type { MessageCategory } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { messaging, env } from "../lib/providers";

export interface NotifyPayload {
  category: MessageCategory;
  recipientEmail: string;
  recipientPhone?: string | null;
  subject: string;
  html: string;
  smsBody?: string;
}

/**
 * ALL messaging sends go through this function — route handlers and domain
 * services NEVER call SMTP/SMS providers directly (messaging-domain.md,
 * backend-api.md, code-reviewer.md all enforce this).
 *
 * Resolution order per send:
 *  1. SMTP always fires (the safety channel).
 *  2. SMS fires only if SMS_GATEWAY env is true AND the category's
 *     MessagingFeatureToggle.smsEnabled is true AND a phone number exists.
 */
export async function notify(payload: NotifyPayload): Promise<{ smtpSent: boolean; smsSent: boolean }> {
  let smtpSent = false;
  let smsSent = false;

  await messaging.sendMail({
    to: payload.recipientEmail,
    subject: payload.subject,
    html: payload.html,
  });
  smtpSent = true;

  if (payload.recipientPhone && messaging.smsAvailable) {
    const toggle = await prisma.messagingFeatureToggle.findUnique({
      where: { category: payload.category },
    });
    if (toggle?.smsEnabled) {
      await messaging.sendSms({
        to: payload.recipientPhone,
        body: payload.smsBody ?? payload.subject,
      });
      smsSent = true;
    }
  }

  return { smtpSent, smsSent };
}

/**
 * Whether the `password_reset` category can currently offer the user an
 * Email/SMS channel picker (messaging-domain.md + auth-rbac.md).
 * Requires env gateway AND the runtime toggle both true.
 */
export async function isPasswordResetSmsAvailable(): Promise<boolean> {
  if (!env.SMS_GATEWAY || !messaging.smsAvailable) return false;
  const toggle = await prisma.messagingFeatureToggle.findUnique({
    where: { category: "password_reset" },
  });
  return Boolean(toggle?.smsEnabled);
}
