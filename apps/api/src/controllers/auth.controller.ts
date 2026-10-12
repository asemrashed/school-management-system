import type { Request, Response } from "express";
import {
  loginSchema,
  registerSchema,
  requestPasswordResetSchema,
  chooseOtpChannelSchema,
  verifyPasswordResetSchema,
  type SessionUser,
} from "@packages/shared-types";
import * as authService from "../services/auth.service";
import { createSession, destroySession } from "../lib/session";
import { generateCsrfToken } from "../middleware/csrf.middleware";

function toSessionUser(user: { id: string; name: string; email: string; role: string }): SessionUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role as SessionUser["role"] };
}

export async function getCsrfToken(req: Request, res: Response) {
  // validateOnReuse=false: after login/logout the browser still holds a CSRF
  // cookie bound to the OLD session identifier. The default (true) makes the
  // library throw on that stale cookie, which would make this endpoint fail
  // and block every mutating request after login. Re-issue instead.
  const token = generateCsrfToken(req, res, false, false);
  res.json({ csrfToken: token });
}

export async function register(req: Request, res: Response) {
  const input = registerSchema.parse(req.body);
  const user = await authService.registerUser(input);
  await createSession(user.id, req, res);
  res.status(201).json({ user: toSessionUser(user) });
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  const user = await authService.verifyLogin(input);
  await createSession(user.id, req, res);
  res.json({ user: toSessionUser(user) });
}

export async function logout(req: Request, res: Response) {
  await destroySession(req, res);
  res.status(204).send();
}

export async function me(req: Request, res: Response) {
  if (!req.user) return res.status(200).json({ user: null });
  res.json({ user: toSessionUser(req.user) });
}

export async function requestPasswordReset(req: Request, res: Response) {
  const input = requestPasswordResetSchema.parse(req.body);
  const result = await authService.requestPasswordReset(input.email);
  res.json(result);
}

export async function chooseOtpChannel(req: Request, res: Response) {
  const input = chooseOtpChannelSchema.parse(req.body);
  await authService.chooseOtpChannel(input.otpRequestId, input.channel);
  res.status(204).send();
}

export async function verifyPasswordReset(req: Request, res: Response) {
  const input = verifyPasswordResetSchema.parse(req.body);
  await authService.completePasswordReset(input.otpRequestId, input.code, input.newPassword);
  res.status(204).send();
}
