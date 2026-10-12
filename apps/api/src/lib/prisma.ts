import { PrismaClient } from "@prisma/client";
import { loadEnv } from "@packages/config";

const env = loadEnv();

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * Single Prisma client instance for the whole process (avoids exhausting
 * connections in dev with hot reload). DATABASE_URL / DATABASE_PROVIDER
 * come from the validated env (packages/config) — never read directly.
 */
export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
