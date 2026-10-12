import type { Role } from "@packages/shared-types";

/**
 * Single source of truth for which dashboard page each role may open.
 * The sidebar, the post-login landing page and the route guard in
 * app/dashboard/layout.tsx all read this, so they cannot drift apart
 * (a parent was previously handed the Accountant page via the sidebar).
 * This is a UX guard only — the API enforces the real authorization.
 */
export const DASHBOARD_ACCESS: Record<string, Role[]> = {
  "/dashboard": ["super_admin", "admin", "coordinator", "teacher", "accountant", "librarian", "parent", "student"],
  "/dashboard/admin": ["super_admin", "admin"],
  "/dashboard/accountant": ["super_admin", "admin", "accountant"],
  "/dashboard/librarian": ["super_admin", "admin", "librarian"],
  "/dashboard/teacher": ["super_admin", "admin", "coordinator", "teacher"],
  "/dashboard/parent": ["parent"],
  "/dashboard/student": ["student"],
};

/** Where each role lands after login. */
export const ROLE_HOME: Record<Role, string> = {
  super_admin: "/dashboard/admin",
  admin: "/dashboard/admin",
  coordinator: "/dashboard/teacher",
  teacher: "/dashboard/teacher",
  accountant: "/dashboard/accountant",
  librarian: "/dashboard/librarian",
  parent: "/dashboard/parent",
  student: "/dashboard/student",
};

export function canAccessPath(role: Role, pathname: string): boolean {
  const key = Object.keys(DASHBOARD_ACCESS)
    .sort((a, b) => b.length - a.length)
    .find((k) => pathname === k || pathname.startsWith(`${k}/`));
  return key ? DASHBOARD_ACCESS[key].includes(role) : false;
}
