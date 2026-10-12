import { z } from "zod";
import { roleSchema } from "./roles";

/** Only these roles may self-register through the public endpoint — every
 * staff role (admin, teacher, accountant, librarian, coordinator,
 * super_admin) must be created by an existing admin via POST /users
 * instead. Enforced again server-side in auth.service.ts — never trust a
 * client-supplied role for a privileged account. */
export const SELF_REGISTERABLE_ROLES = ["parent", "student"] as const;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must include an uppercase letter")
    .regex(/[0-9]/, "Must include a number"),
  role: z.enum(SELF_REGISTERABLE_ROLES),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const sessionUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: roleSchema,
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

/** Step 1: request an OTP for a given account. */
export const requestPasswordResetSchema = z.object({
  email: z.string().email(),
});
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

/**
 * Response tells the client whether a channel picker should be shown.
 * Channel choice is only offered when SMS is effectively enabled
 * for the `password_reset` category (see messaging-domain.md).
 */
export const requestPasswordResetResponseSchema = z.object({
  otpRequestId: z.string(),
  availableChannels: z.array(z.enum(["email", "sms"])).min(1),
  channelChoiceRequired: z.boolean(),
});
export type RequestPasswordResetResponse = z.infer<
  typeof requestPasswordResetResponseSchema
>;

/** Step 2: user picks a channel (only sent if channelChoiceRequired was true). */
export const chooseOtpChannelSchema = z.object({
  otpRequestId: z.string(),
  channel: z.enum(["email", "sms"]),
});
export type ChooseOtpChannelInput = z.infer<typeof chooseOtpChannelSchema>;

/** Step 3: verify the 6-digit code + set a new password. */
export const verifyPasswordResetSchema = z.object({
  otpRequestId: z.string(),
  code: z.string().length(6).regex(/^\d{6}$/, "OTP must be 6 digits"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must include an uppercase letter")
    .regex(/[0-9]/, "Must include a number"),
});
export type VerifyPasswordResetInput = z.infer<typeof verifyPasswordResetSchema>;
