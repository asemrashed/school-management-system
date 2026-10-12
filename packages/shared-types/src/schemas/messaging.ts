import { z } from "zod";

/** Must stay in sync with messaging-domain.md category table. */
export const MESSAGE_CATEGORIES = [
  "registration_credentials",
  "absence_alert",
  "fee_due",
  "exam_schedule",
  "result_published",
  "assignment_posted",
  "general_notice",
  "password_reset",
] as const;

export const messageCategorySchema = z.enum(MESSAGE_CATEGORIES);
export type MessageCategory = z.infer<typeof messageCategorySchema>;

export const messagingFeatureToggleDtoSchema = z.object({
  category: messageCategorySchema,
  smsEnabled: z.boolean(),
  smsEligible: z.boolean(), // whether this category may ever use SMS (fixed by domain rules)
});
export type MessagingFeatureToggleDto = z.infer<
  typeof messagingFeatureToggleDtoSchema
>;

export const updateMessagingFeatureToggleSchema = z.object({
  category: messageCategorySchema,
  smsEnabled: z.boolean(),
});
export type UpdateMessagingFeatureToggleInput = z.infer<
  typeof updateMessagingFeatureToggleSchema
>;
