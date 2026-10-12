import bcrypt from "bcryptjs";
import type { RegisterInput, LoginInput } from "@packages/shared-types";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { notify, isPasswordResetSmsAvailable } from "./notification.service";
import { createRoleProfile } from "./profile.service";
import { assertRoleCapacity, SERIALIZABLE, mapSerializationError } from "./role-limits.service";
import {
  assertNotRateLimited,
  createOtp,
  regenerateCode,
  setOtpChannel,
  verifyOtp,
} from "./otp.service";

export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw AppError.conflict("An account with this email already exists.");

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma
    .$transaction(async (tx) => {
      await assertRoleCapacity(input.role, tx);
      const created = await tx.user.create({
        data: { name: input.name, email: input.email, passwordHash, role: input.role },
      });
      await createRoleProfile(tx, created.id, created.role);
      return created;
    }, SERIALIZABLE)
    .catch(mapSerializationError);

  await notify({
    category: "registration_credentials",
    recipientEmail: user.email,
    subject: "Welcome to your school portal",
    html: `<p>Hi ${user.name},</p><p>Your account has been created with role <strong>${user.role}</strong>.</p>`,
  });

  return user;
}

export async function verifyLogin(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || user.deletedAt || !user.isActive) {
    throw AppError.badRequest("INVALID_CREDENTIALS", "Invalid email or password.");
  }

  const matches = await bcrypt.compare(input.password, user.passwordHash);
  if (!matches) {
    throw AppError.badRequest("INVALID_CREDENTIALS", "Invalid email or password.");
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return user;
}

/**
 * Step 1 of password reset. Decides whether a channel picker is needed
 * (auth-rbac.md): only when SMS is effectively available for the
 * `password_reset` category. Otherwise sends the email immediately.
 */
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  // Always return a generic success shape even if the user doesn't exist,
  // to avoid leaking which emails are registered.
  if (!user) {
    return {
      otpRequestId: "noop",
      availableChannels: ["email"] as const,
      channelChoiceRequired: false,
    };
  }

  await assertNotRateLimited(user.id);
  const smsAvailable = await isPasswordResetSmsAvailable();
  const { otpRequestId, code } = await createOtp(user.id);

  if (!smsAvailable) {
    await setOtpChannel(otpRequestId, "email");
    await notify({
      category: "password_reset",
      recipientEmail: user.email,
      subject: "Your password reset code",
      html: `<p>Your verification code is <strong>${code}</strong>. It expires in 10 minutes.</p>`,
    });
    return { otpRequestId, availableChannels: ["email"] as const, channelChoiceRequired: false };
  }

  // Channel choice required — code is sent once the user picks (see chooseOtpChannel).
  return { otpRequestId, availableChannels: ["email", "sms"] as const, channelChoiceRequired: true };
}

export async function chooseOtpChannel(otpRequestId: string, channel: "email" | "sms") {
  if (otpRequestId === "noop") return;

  const otp = await prisma.passwordResetOtp.findUnique({
    where: { id: otpRequestId },
    include: { user: true },
  });
  if (!otp || otp.consumedAt) {
    throw AppError.badRequest("OTP_INVALID", "This reset request is invalid. Please start again.");
  }

  await setOtpChannel(otpRequestId, channel);

  // Mint a fresh code on the SAME otp row (we only ever store a hash, never
  // the raw code, so the code from step 1 can't be re-sent — but the
  // client-held otpRequestId must stay valid for the verify step).
  const { code } = await regenerateCode(otpRequestId);

  if (channel === "email") {
    await notify({
      category: "password_reset",
      recipientEmail: otp.user.email,
      subject: "Your password reset code",
      html: `<p>Your verification code is <strong>${code}</strong>. It expires in 10 minutes.</p>`,
    });
  } else {
    const phone = await resolveUserPhone(otp.userId);
    if (!phone) {
      throw AppError.badRequest("NO_PHONE_ON_FILE", "No phone number on file for SMS delivery.");
    }
    await notify({
      category: "password_reset",
      recipientEmail: otp.user.email,
      recipientPhone: phone,
      subject: "Your password reset code",
      html: `<p>Your verification code is <strong>${code}</strong>.</p>`,
      smsBody: `Your school portal reset code is ${code}. It expires in 10 minutes.`,
    });
  }
}

async function resolveUserPhone(userId: string): Promise<string | null> {
  const teacher = await prisma.teacher.findUnique({ where: { userId } });
  if (teacher?.phone) return teacher.phone;
  const staff = await prisma.staff.findUnique({ where: { userId } });
  if (staff?.phone) return staff.phone;
  const guardian = await prisma.guardian.findUnique({ where: { userId } });
  if (guardian?.phone) return guardian.phone;
  return null;
}

export async function completePasswordReset(
  otpRequestId: string,
  code: string,
  newPassword: string
) {
  if (otpRequestId === "noop") {
    // Consumed a fake request id — behave as if the code were wrong, never
    // reveal that the underlying email doesn't exist.
    throw AppError.badRequest("OTP_INCORRECT", "That code doesn't match. Please try again.");
  }
  const otp = await verifyOtp(otpRequestId, code);
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: otp.userId }, data: { passwordHash } });
  // Invalidate all existing sessions on password change.
  await prisma.session.deleteMany({ where: { userId: otp.userId } });
}
