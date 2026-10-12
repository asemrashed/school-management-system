import type { NextFunction, Request, Response } from "express";
import type { RoleName, PermissionAction } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";

/** Restrict a route to a fixed set of roles. Use requireAuth first. */
export function requireRole(...roles: RoleName[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) return next(AppError.forbidden());
    next();
  };
}

/**
 * Checks the runtime Permission matrix (module.action) that Super Admin
 * manages (auth-rbac-matrix.md). super_admin always passes.
 */
export function requirePermission(module: string, action: PermissionAction) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    if (req.user.role === "super_admin") return next();

    const permission = await prisma.permission.findUnique({
      where: { role_module_action: { role: req.user.role, module, action } },
    });

    if (!permission || !permission.allowed) return next(AppError.forbidden());
    next();
  };
}
