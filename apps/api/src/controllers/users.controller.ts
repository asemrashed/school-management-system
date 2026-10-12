import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { createUserSchema, offsetPaginationQuerySchema, type UserDto } from "@packages/shared-types";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { notify } from "../services/notification.service";
import { createRoleProfile } from "../services/profile.service";
import { assertRoleCapacity, SERIALIZABLE, mapSerializationError } from "../services/role-limits.service";

function toDto(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
}): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserDto["role"],
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function listUsers(req: Request, res: Response) {
  const { page, limit } = offsetPaginationQuerySchema.parse(req.query);
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where: { deletedAt: null } }),
  ]);
  res.json({ items: items.map(toDto), total, nextCursor: null });
}

export async function createUser(req: Request, res: Response) {
  const input = createUserSchema.parse(req.body);

  // A plain admin can create staff of any role EXCEPT super_admin — minting
  // a fresh super_admin account is restricted to an existing super_admin,
  // so a compromised (or malicious) plain-admin account can't hand itself
  // the top role (auth-rbac-matrix.md's "Super Admin" tier is meant to stay
  // a small, deliberately-granted set).
  if (input.role === "super_admin" && req.user!.role !== "super_admin") {
    throw AppError.forbidden("Only a Super Admin can create another Super Admin account.");
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw AppError.conflict("An account with this email already exists.");

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma
      .$transaction(async (tx) => {
        await assertRoleCapacity(input.role, tx);
        const created = await tx.user.create({
          data: { name: input.name, email: input.email, role: input.role, passwordHash },
        });
        await createRoleProfile(tx, created.id, created.role);
        return created;
      }, SERIALIZABLE)
      .catch(mapSerializationError);

    await notify({
      category: "registration_credentials",
      recipientEmail: user.email,
      subject: "Your school portal account",
      html: `<p>Hi ${user.name},</p><p>An account was created for you with role <strong>${user.role}</strong>. Use "Forgot password" to set your password.</p>`,
    });

    return res.status(201).json({ user: toDto(user) });
  } catch (err) {
    // Log full error for debugging (dev only)
    // eslint-disable-next-line no-console
    console.error("[createUser error]", err instanceof Error ? err.stack ?? err.message : err);
    throw err;
  }
}
