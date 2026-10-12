import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/errors";

/** Structured log line — see error-handling-logging.md. Swap for a real logger later. */
function logError(req: Request, err: unknown, status: number) {
  // eslint-disable-next-line no-console
  console.error(
    JSON.stringify({
      level: status >= 500 ? "error" : "warn",
      msg: err instanceof Error ? err.message : "Unknown error",
      reqId: req.headers["x-request-id"] ?? undefined,
      userId: (req as any).user?.id,
      route: req.originalUrl,
      method: req.method,
    })
  );
}

export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    logError(req, err, 400);
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      details: { issues: err.issues },
    });
  }

  // csrf-csrf raises an http-errors error with code EBADCSRFTOKEN.
  if ((err as any)?.code === "EBADCSRFTOKEN") {
    logError(req, err, 403);
    return res.status(403).json({ code: "CSRF_INVALID", message: "Security token missing or expired. Please try again." });
  }

  // multer (uploads) — oversize / malformed multipart is a client error, not a 500.
  if ((err as any)?.name === "MulterError") {
    const tooBig = (err as any).code === "LIMIT_FILE_SIZE";
    logError(req, err, tooBig ? 413 : 400);
    return res.status(tooBig ? 413 : 400).json({
      code: tooBig ? "FILE_TOO_LARGE" : "UPLOAD_INVALID",
      message: tooBig ? "That file is larger than the 20MB limit." : "The upload could not be processed.",
    });
  }

  if (err instanceof AppError) {
    logError(req, err, err.status);
    return res.status(err.status).json({
      code: err.code,
      message: err.message,
      details: err.details,
    });
  }

  logError(req, err, 500);
  return res.status(500).json({
    code: "INTERNAL_ERROR",
    message: "Something went wrong. Please try again.",
  });
}

export function notFoundMiddleware(req: Request, res: Response) {
  res.status(404).json({ code: "NOT_FOUND", message: `No route for ${req.method} ${req.path}` });
}
