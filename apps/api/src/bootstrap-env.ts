import path from "node:path";
import dotenv from "dotenv";

/**
 * Must be the FIRST import in any entrypoint (src/index.ts, prisma/seed.ts)
 * — every other module (packages/config/src/env.ts via lib/prisma.ts and
 * lib/providers.ts) reads process.env at import time, so this has to run
 * before those imports execute.
 *
 * .env.local is untracked (see .gitignore) and wins; .env is the
 * committed-safe example/fallback. dotenv.config() never overwrites a
 * variable that's already set, so loading both in this order is safe.
 */
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
