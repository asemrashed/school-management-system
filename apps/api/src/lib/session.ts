import type { Request, Response } from "express";
import crypto from "node:crypto";
import { prisma } from "./prisma";
import { env } from "./providers";

export const SESSION_COOKIE = "sms_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function signToken(raw: string): string {
  const hmac = crypto.createHmac("sha256", env.SESSION_SECRET);
  hmac.update(raw);
  return `${raw}.${hmac.digest("hex")}`;
}

function verifyToken(signed: string): string | null {
  const idx = signed.lastIndexOf(".");
  if (idx === -1) return null;
  const raw = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  const expected = crypto.createHmac("sha256", env.SESSION_SECRET).update(raw).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return raw;
}

export async function createSession(
  userId: string,
  req: Request,
  res: Response
): Promise<void> {
  if (env.DEVICE_CONTROL_ENABLED) {
    await enforceDeviceLimit(userId);
  }

  const sessionId = crypto.randomUUID();
  await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      ipAddress: req.ip,
      userAgent: req.get("user-agent") ?? undefined,
    },
  });

  res.cookie(SESSION_COOKIE, signToken(sessionId), {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

/**
 * Only runs when DEVICE_CONTROL_ENABLED=true (packages/config env). Looks
 * up this user's role limit in DeviceLimit; if none is configured for the
 * role, there's no cap. Evicts the oldest active session(s) to make room
 * for a new login rather than blocking it outright.
 */
async function enforceDeviceLimit(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const limit = await prisma.deviceLimit.findUnique({ where: { role: user.role } });
  if (!limit) return;

  const activeSessions = await prisma.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "asc" },
  });

  // -1 because the session about to be created will make activeSessions + 1.
  const excess = activeSessions.length - (limit.maxSessions - 1);
  if (excess > 0) {
    const toEvict = activeSessions.slice(0, excess).map((s) => s.id);
    await prisma.session.deleteMany({ where: { id: { in: toEvict } } });
  }
}

export async function destroySession(req: Request, res: Response): Promise<void> {
  const signed = req.cookies?.[SESSION_COOKIE];
  const sessionId = signed ? verifyToken(signed) : null;
  if (sessionId) {
    await prisma.session.deleteMany({ where: { id: sessionId } }).catch(() => undefined);
  }
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export async function getSessionUser(req: Request) {
  const signed = req.cookies?.[SESSION_COOKIE];
  if (!signed) return null;
  const sessionId = verifyToken(signed);
  if (!sessionId) return null;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) return null;
  if (!session.user.isActive || session.user.deletedAt) return null;

  return session.user;
}
