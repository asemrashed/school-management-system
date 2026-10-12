import type { NextFunction, Request, Response } from "express";
import type { User } from "@prisma/client";
import { getSessionUser } from "../lib/session";
import { AppError } from "../lib/errors";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/** Populates req.user if a valid session cookie is present. Never rejects. */
export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  const user = await getSessionUser(req);
  if (user) req.user = user;
  next();
}

/** Every protected route uses this AFTER attachUser (see auth-rbac.md). */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(AppError.unauthorized());
  next();
}
