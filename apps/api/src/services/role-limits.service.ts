import type { Prisma } from "@prisma/client";
import type { Role, RoleAccountLimitRow } from "@packages/shared-types";
import { ROLES } from "@packages/shared-types";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";

/**
 * Super-Admin-controlled cap on ACTIVE accounts per role (e.g. "at most 3
 * accountants"). No row = unlimited. Deactivated and soft-deleted users do
 * not count, so freeing a seat is as simple as disabling an account.
 * Lowering a cap below the current count never removes anyone — it only
 * blocks new accounts until the count drops.
 */

type Db = Pick<Prisma.TransactionClient, "user" | "roleAccountLimit">;

const countActive = (db: Db, role: Role) => db.user.count({ where: { role, isActive: true, deletedAt: null } });

/** Serializable isolation makes the count-then-insert atomic: of two
 * simultaneous creations at the cap, one commits and the other fails with a
 * serialization error (P2034), which callers map to a retryable 409. */
export const SERIALIZABLE = { isolationLevel: "Serializable" as const };

export function mapSerializationError(err: unknown): never {
  if ((err as { code?: string })?.code === "P2034") {
    throw AppError.conflict("Another account was being created at the same time. Please try again.");
  }
  throw err;
}

/** Pass the transaction client when creating the user in the same transaction. */
export async function assertRoleCapacity(role: Role, db: Db = prisma): Promise<void> {
  const limit = await db.roleAccountLimit.findUnique({ where: { role } });
  if (!limit) return;
  const active = await countActive(db, role);
  if (active >= limit.maxAccounts) {
    throw new AppError(
      "ROLE_LIMIT_REACHED",
      `The ${role.replace("_", " ")} account limit (${limit.maxAccounts}) has been reached. Ask a Super Admin to raise it or disable an existing account.`,
      409,
      { role, maxAccounts: limit.maxAccounts, activeAccounts: active }
    );
  }
}

export async function listRoleAccountLimits(): Promise<RoleAccountLimitRow[]> {
  const limits = await prisma.roleAccountLimit.findMany();
  const byRole = new Map(limits.map((l) => [l.role, l.maxAccounts]));
  return Promise.all(
    ROLES.map(async (role) => ({
      role,
      maxAccounts: byRole.get(role) ?? null,
      activeAccounts: await countActive(prisma, role),
    }))
  );
}

export async function setRoleAccountLimit(role: Role, maxAccounts: number | null): Promise<void> {
  if (maxAccounts === null) {
    await prisma.roleAccountLimit.deleteMany({ where: { role } });
    return;
  }
  await prisma.roleAccountLimit.upsert({
    where: { role },
    update: { maxAccounts },
    create: { role, maxAccounts },
  });
}
