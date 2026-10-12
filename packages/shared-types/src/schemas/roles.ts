import { z } from "zod";

/**
 * Single source of truth for roles (see auth-rbac-matrix.md).
 * Prisma enum, Zod schema, and client code all derive from this list.
 */
export const ROLES = [
  "super_admin",
  "admin",
  "coordinator",
  "teacher",
  "accountant",
  "librarian",
  "parent",
  "student",
] as const;

export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

/**
 * module.action permission keys — extend as new modules are added.
 * Keep in sync with auth-rbac-matrix.md when adding modules.
 */
export const PERMISSION_MODULES = [
  "students",
  "teachers",
  "fees",
  "library",
  "exams",
  "assignments",
  "resources",
  "attendance",
  "notices",
  "cms",
  "salary",
  "reports",
  "device",
  "messaging.settings",
] as const;

export const permissionActionSchema = z.enum(["read", "write"]);
export type PermissionAction = z.infer<typeof permissionActionSchema>;

export const permissionKeySchema = z.string().regex(/^[a-z.]+\.(read|write)$/);
