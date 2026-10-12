export class AppError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(code: string, message: string, status = 400, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }

  static badRequest(code: string, message: string, details?: Record<string, unknown>) {
    return new AppError(code, message, 400, details);
  }
  static unauthorized(message = "Authentication required") {
    return new AppError("UNAUTHORIZED", message, 401);
  }
  static forbidden(message = "You do not have permission to do this") {
    return new AppError("FORBIDDEN", message, 403);
  }
  static notFound(message = "Resource not found") {
    return new AppError("NOT_FOUND", message, 404);
  }
  static conflict(message: string) {
    return new AppError("CONFLICT", message, 409);
  }
  static rateLimited(message = "Too many requests") {
    return new AppError("RATE_LIMITED", message, 429);
  }
}

import type { NextFunction, Request, Response } from "express";

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** Wrap every async route handler so rejected promises reach the error middleware. */
export function asyncHandler(fn: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
