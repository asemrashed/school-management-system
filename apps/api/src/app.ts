import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./lib/providers";
import { localUploadDir } from "@packages/config";
import { attachUser } from "./middleware/auth.middleware";
import { doubleCsrfProtection } from "./middleware/csrf.middleware";
import { generalApiRateLimiter } from "./middleware/rate-limit.middleware";
import { errorMiddleware, notFoundMiddleware } from "./middleware/error.middleware";
import { authRouter } from "./routes/auth.routes";
import { usersRouter } from "./routes/users.routes";
import { messagingRouter } from "./routes/messaging.routes";
import { academicsRouter } from "./routes/academics.routes";
import { attendanceRouter } from "./routes/attendance.routes";
import { feesRouter } from "./routes/fees.routes";
import { engagementRouter } from "./routes/engagement.routes";
import { lmsRouter } from "./routes/lms.routes";
import { examsRouter } from "./routes/exams.routes";
import { salaryRouter } from "./routes/salary.routes";
import { libraryRouter } from "./routes/library.routes";
import { cmsRouter } from "./routes/cms.routes";
import { publicRouter } from "./routes/public.routes";
import { reportsRouter } from "./routes/reports.routes";
import { deviceRouter } from "./routes/device.routes";
import { uploadsRouter } from "./routes/uploads.routes";
import { roleLimitsRouter } from "./routes/role-limits.routes";
import { setupRouter } from "./routes/setup.routes";
import { lookupRouter } from "./routes/lookup.routes";
import { studentsRouter } from "./routes/students.routes";
import { siteRouter } from "./routes/site.routes";
import { paymentCallbackRouter } from "./routes/payment-callback.routes";

export const app = express();

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: "same-site" },
  })
);
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));

// Files saved by STORAGE_PROVIDER=local. Allow-listed types only are ever written
// (uploads.controller), nosniff stops a browser guessing a different type, and CORP
// "cross-origin" lets the web app (another origin) display the images.
if (env.STORAGE_PROVIDER === "local") {
  app.use(
    "/files",
    express.static(localUploadDir(env), {
      index: false,
      dotfiles: "deny",
      setHeaders: (res) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      },
    })
  );
}
app.use(cookieParser());
app.use(generalApiRateLimiter);
app.use(attachUser);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Gateway callbacks cannot carry our CSRF token or cookies; they are verified
// server-to-server instead (see fees.controller sslcommerzCallback).
app.use("/fees/payments/callback", paymentCallbackRouter);

// CSRF protection applies to all mutating requests except the token-issuing
// GET route and initial register/login (which are cookie-less until the
// session is created). Extend this allowlist carefully.
app.use((req, res, next) => {
  const exempt =
    req.method === "GET" ||
    req.path === "/auth/register" ||
    req.path === "/auth/login" ||
    // Public visitors have no session, hence no CSRF token; these endpoints
    // change nothing for any logged-in user and are rate-limited + honeypotted.
    req.path === "/public/contact" ||
    req.path === "/public/admission";
  if (exempt) return next();
  return doubleCsrfProtection(req, res, next);
});

app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/messaging", messagingRouter);
app.use("/academics", academicsRouter);
app.use("/attendance", attendanceRouter);
app.use("/fees", feesRouter);
app.use("/engagement", engagementRouter);
app.use("/lms", lmsRouter);
app.use("/exams", examsRouter);
app.use("/salary", salaryRouter);
app.use("/library", libraryRouter);
app.use("/cms", cmsRouter);
app.use("/public", publicRouter);
app.use("/reports", reportsRouter);
app.use("/device", deviceRouter);
app.use("/uploads", uploadsRouter);
app.use("/role-limits", roleLimitsRouter);
app.use("/setup", setupRouter);
app.use("/lookup", lookupRouter);
app.use("/students", studentsRouter);
app.use("/site", siteRouter);

app.use(notFoundMiddleware);
app.use(errorMiddleware);
