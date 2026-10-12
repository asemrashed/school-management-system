import path from "node:path";
import { randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { AppError } from "../lib/errors";
import { storage } from "../lib/providers";

/** extension -> mime types we accept for it. Anything else is rejected, so
 * HTML/SVG/JS/executables can never be hosted from the school's storage. */
const DOCUMENT_TYPES: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".doc": ["application/msword"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".ppt": ["application/vnd.ms-powerpoint"],
  ".pptx": ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  ".xls": ["application/vnd.ms-excel"],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ".txt": ["text/plain"],
  ".png": ["image/png"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".webp": ["image/webp"],
  ".gif": ["image/gif"],
};
const VIDEO_TYPES: Record<string, string[]> = {
  ".mp4": ["video/mp4"],
  ".webm": ["video/webm"],
};

/** Students submit homework: documents and images only. Teachers/admins can
 * also upload recorded classes. */
function allowedTypesFor(role: string) {
  return role === "student" ? DOCUMENT_TYPES : { ...DOCUMENT_TYPES, ...VIDEO_TYPES };
}

/**
 * Generic authenticated upload endpoint. Any feature that needs a file URL
 * (Resource, CMS page images, etc.) calls this first, then stores the
 * returned `url` on its own record — this endpoint doesn't know about
 * resources/pages/anything else, matching the storage provider being
 * feature-agnostic (packages/config/src/providers/storage.ts).
 *
 * The route restricts WHO may upload (uploads.routes.ts); this restricts
 * WHAT: an extension + MIME allowlist, and a server-generated filename so a
 * caller can neither overwrite someone else's file nor smuggle a path.
 */
export async function uploadFile(req: Request, res: Response) {
  const file = req.file;
  if (!file) throw AppError.badRequest("NO_FILE", "No file was uploaded.");

  const ext = path.extname(file.originalname).toLowerCase();
  const accepted = allowedTypesFor(req.user!.role)[ext];
  if (!accepted || !accepted.includes(file.mimetype)) {
    throw AppError.badRequest("FILE_TYPE_NOT_ALLOWED", "This file type is not allowed.");
  }

  const base = path
    .basename(file.originalname, path.extname(file.originalname))
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "file";
  const safeName = `${randomBytes(6).toString("hex")}-${base}${ext}`;

  const folder = `school/${req.user!.role}`;
  const result = await storage.upload(file.buffer, folder, safeName);
  res.status(201).json({ url: result.url, publicId: result.publicId });
}
