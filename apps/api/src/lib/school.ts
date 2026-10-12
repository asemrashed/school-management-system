import { prisma } from "./prisma";
import { AppError } from "./errors";

/**
 * This product is single-school: there is exactly one School row (created by
 * the seed script). Controllers that must attach a record to "the school"
 * resolve it here rather than trusting an id from the client.
 */
export async function getSchoolId(): Promise<string> {
  const school = await prisma.school.findFirst({ where: { deletedAt: null }, orderBy: { createdAt: "asc" } });
  if (!school) {
    throw AppError.badRequest("SCHOOL_NOT_SEEDED", "No school exists yet. Run `npm run prisma:seed` first.");
  }
  return school.id;
}
