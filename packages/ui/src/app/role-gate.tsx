import * as React from "react";
import type { Role } from "@packages/shared-types";

/**
 * Canonical pattern for role-based conditional rendering (ui-component-library.md).
 * NEVER fork components per role — wrap the role-specific parts in RoleGate instead.
 *
 * Client-side gating is a UX convenience only — the server ALWAYS re-checks
 * permissions (auth-rbac-matrix.md).
 */
export function RoleGate({
  allow,
  currentRole,
  fallback = null,
  children,
}: {
  allow: Role[];
  currentRole: Role | undefined;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (!currentRole || !allow.includes(currentRole)) return <>{fallback}</>;
  return <>{children}</>;
}
