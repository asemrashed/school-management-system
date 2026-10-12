import type { Prisma, RoleName } from "@prisma/client";

/**
 * Every non-super_admin role has a matching profile row the rest of the app
 * depends on: Guardian (parent), Student, Teacher, or Staff (admin,
 * coordinator, accountant, librarian). Call this in the SAME transaction as
 * the User creation — both account-creation paths (self-registration in
 * auth.service.ts and admin-created users in users.controller.ts) need it,
 * so it lives here once rather than being duplicated (and silently
 * forgotten in one of the two places, which is exactly what happened
 * before this existed).
 */
export async function createRoleProfile(
  tx: Prisma.TransactionClient,
  userId: string,
  role: RoleName
): Promise<void> {
  switch (role) {
    case "parent":
      await tx.guardian.create({ data: { userId } });
      return;
    case "student":
      // sectionId/rollNumber/guardianId are optional — an admin assigns a
      // section (and, for self-registered students, a guardian) afterwards.
      await tx.student.create({ data: { userId } });
      return;
    case "teacher":
      await tx.teacher.create({ data: { userId } });
      return;
    case "admin":
    case "coordinator":
    case "accountant":
    case "librarian":
      await tx.staff.create({ data: { userId, designation: role } });
      return;
    case "super_admin":
      return; // no profile row needed
    default: {
      const _exhaustive: never = role;
      throw new Error(`createRoleProfile: unhandled role ${_exhaustive}`);
    }
  }
}
