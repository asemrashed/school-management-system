import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";

const OTP_TTL_MINUTES = 10;
const MAX_REQUESTS_PER_WINDOW = 3;
const WINDOW_MINUTES = 15;
const MAX_VERIFY_ATTEMPTS = 5;

function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Enforces max 3 requests / 15 min / account (messaging-domain.md, db-schema.md). */
export async function assertNotRateLimited(userId: string) {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
  const recentCount = await prisma.passwordResetOtp.count({
    where: { userId, createdAt: { gte: since } },
  });
  if (recentCount >= MAX_REQUESTS_PER_WINDOW) {
    throw AppError.rateLimited(
      `Too many reset requests. Please wait a few minutes and try again.`
    );
  }
}

/** Creates a new OTP row (channel is set later, once the user picks or it's auto-decided). */
export async function createOtp(userId: string) {
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  const otp = await prisma.passwordResetOtp.create({
    data: {
      userId,
      codeHash,
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
    },
  });
  return { otpRequestId: otp.id, code };
}

/**
 * Mints a fresh code for an EXISTING otp request row (same otpRequestId),
 * resetting expiry/attempts. Used when the channel is chosen after the
 * request was created, so the client-held otpRequestId stays valid.
 */
export async function regenerateCode(otpRequestId: string) {
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  await prisma.passwordResetOtp.update({
    where: { id: otpRequestId },
    data: {
      codeHash,
      attempts: 0,
      consumedAt: null,
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
    },
  });
  return { code };
}

export async function setOtpChannel(otpRequestId: string, channel: "email" | "sms") {
  await prisma.passwordResetOtp.update({
    where: { id: otpRequestId },
    data: { channel },
  });
}

export async function verifyOtp(otpRequestId: string, code: string) {
  const otp = await prisma.passwordResetOtp.findUnique({ where: { id: otpRequestId } });

  if (!otp || otp.consumedAt) {
    throw AppError.badRequest("OTP_INVALID", "This code is invalid. Please request a new one.");
  }
  if (otp.expiresAt < new Date()) {
    throw AppError.badRequest("OTP_EXPIRED", "This code has expired. Please request a new one.");
  }
  if (otp.attempts >= MAX_VERIFY_ATTEMPTS) {
    throw AppError.rateLimited("Too many incorrect attempts. Please request a new code.");
  }

  const matches = await bcrypt.compare(code, otp.codeHash);
  if (!matches) {
    await prisma.passwordResetOtp.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    throw AppError.badRequest("OTP_INCORRECT", "That code doesn't match. Please try again.");
  }

  await prisma.passwordResetOtp.update({
    where: { id: otp.id },
    data: { consumedAt: new Date() },
  });

  return otp;
}
