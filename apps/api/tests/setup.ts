import { vi } from "vitest";

// Env for the app under test — set BEFORE any app module is imported.
Object.assign(process.env, {
  NODE_ENV: "test",
  SESSION_SECRET: "test-session-secret-test-session-secret-1234",
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  SMTP_HOST: "smtp.test",
  SMTP_PORT: "465",
  SMTP_USER: "user",
  SMTP_PASS: "pass",
  SMTP_FROM: "Test School <no-reply@test.school>",
  STORAGE_PROVIDER: "cloudinary",
  CLOUDINARY_CLOUD_NAME: "test-cloud",
  CLOUDINARY_API_KEY: "key",
  CLOUDINARY_API_SECRET: "secret",
  SMS_GATEWAY: "false",
  DEVICE_CONTROL_ENABLED: "true",
  RATE_LIMIT_DISABLED: "true",
  CORS_ORIGIN: "http://localhost:3000",
});

const g = globalThis as any;
g.__mailbox = [];
g.__uploads = [];

// In-memory DB instead of Postgres.
vi.mock("../src/lib/prisma", async () => {
  const { createFakePrisma } = await import("./helpers/fake-prisma");
  g.__fakePrisma = createFakePrisma();
  return { prisma: g.__fakePrisma };
});

// Capture outgoing email instead of talking to Gmail.
vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({
      sendMail: async (msg: any) => {
        g.__mailbox.push(msg);
      },
    }),
  },
}));

// Capture uploads instead of talking to Cloudinary.
vi.mock("cloudinary", () => ({
  v2: {
    config: () => {},
    uploader: {
      upload_stream: (opts: any, cb: (e: any, r: any) => void) => ({
        end: (buf: Buffer) => {
          g.__uploads.push({ opts, bytes: buf.length });
          cb(null, {
            secure_url: `https://res.cloudinary.com/test-cloud/raw/upload/${opts.public_id}`,
            public_id: opts.public_id,
          });
        },
      }),
      destroy: async () => {},
    },
  },
}));
