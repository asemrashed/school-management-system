import { z } from "zod";

/**
 * `z.coerce.boolean()` is a footgun for env vars: it does JS's `Boolean(x)`
 * coercion, so the STRING "false" (non-empty) coerces to `true`. Every
 * boolean flag below must parse the literal "true"/"1" vs "false"/"0"
 * strings instead.
 */
function envBoolean(defaultValue: boolean) {
  return z
    .string()
    .optional()
    .transform((val) => {
      if (val === undefined) return defaultValue;
      return val === "true" || val === "1";
    });
}

/**
 * All env vars used across /apps/api (and server-side /apps/web code) are
 * declared and validated here. Boot fails fast if anything required is
 * missing/invalid (devops.md).
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().default(4000),

    // --- Session / cookies ---
    SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 chars"),
    COOKIE_SECURE: envBoolean(false),
    CORS_ORIGIN: z.string().default("http://localhost:3000"),

    // --- Database (Neon default / VPS-local prod) ---
    DATABASE_PROVIDER: z.enum(["neon", "vps-local"]).default("neon"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

    // --- Storage provider factory ---
    STORAGE_PROVIDER: z.enum(["cloudinary", "s3", "r2", "local"]).default("cloudinary"),
    /** STORAGE_PROVIDER=local only: folder for uploaded files (relative to where the API starts). Served at /files. */
    UPLOAD_DIR: z.string().default("./uploads"),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    S3_BUCKET: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET: z.string().optional(),
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),

    // --- Messaging: SMTP always on ---
    SMTP_HOST: z.string().min(1, "SMTP_HOST is required"),
    SMTP_PORT: z.coerce.number().int().default(587),
    SMTP_USER: z.string().min(1),
    SMTP_PASS: z.string().min(1),
    SMTP_FROM: z.string().min(1),

    // --- Messaging: SMS gated by env toggle (messaging-domain.md) ---
    SMS_GATEWAY: envBoolean(false),
    SMS_PROVIDER: z.enum(["none", "custom"]).default("none"),
    SMS_API_KEY: z.string().optional(),
    SMS_API_SECRET: z.string().optional(),
    SMS_SENDER_ID: z.string().optional(),

    // --- Device control (env-driven limits per role/user, Phase 4) ---
    DEVICE_CONTROL_ENABLED: envBoolean(false),

    // --- Payment gateways (ERP fees — Phase 2) ---
    // Sandbox: every online method works against the school's OWN fake checkout
    // page (no real money, no merchant account). For local dev and demos only.
    PAYMENT_SANDBOX: envBoolean(false),
    // Public base URL of the web app, used to build gateway return links.
    PUBLIC_WEB_URL: z.string().url().default("http://localhost:3000"),
    PUBLIC_API_URL: z.string().url().default("http://localhost:4000"),
    BKASH_ENABLED: envBoolean(false),
    BKASH_API_KEY: z.string().optional(),
    BKASH_API_SECRET: z.string().optional(),
    NAGAD_ENABLED: envBoolean(false),
    NAGAD_MERCHANT_ID: z.string().optional(),
    NAGAD_PRIVATE_KEY: z.string().optional(),
    SSLCOMMERZ_ENABLED: envBoolean(false),
    SSLCOMMERZ_STORE_ID: z.string().optional(),
    SSLCOMMERZ_STORE_PASSWORD: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.SMS_GATEWAY && val.SMS_PROVIDER === "none") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SMS_GATEWAY=true requires SMS_PROVIDER to be set to a real provider",
        path: ["SMS_PROVIDER"],
      });
    }
    if (val.STORAGE_PROVIDER === "cloudinary" && !val.CLOUDINARY_CLOUD_NAME) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CLOUDINARY_CLOUD_NAME is required when STORAGE_PROVIDER=cloudinary",
        path: ["CLOUDINARY_CLOUD_NAME"],
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

/** Call once at boot (see apps/api/src/index.ts). Throws on invalid config. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cachedEnv) return cachedEnv;
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    // eslint-disable-next-line no-console
    console.error(`Invalid environment configuration:\n${formatted}`);
    throw new Error("Environment validation failed — see logged issues above.");
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}

/** Derived flag used across the app instead of re-checking two fields everywhere. */
export function isSmsEffectivelyAvailable(env: Env): boolean {
  return env.SMS_GATEWAY && env.SMS_PROVIDER !== "none";
}
