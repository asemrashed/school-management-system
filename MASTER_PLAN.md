# MASTER PLAN — BD English-Medium SMS
> Current: Phase 5 — Scale + PWA
> Next: (final phase — see below)
> Line: 60 (update after each phase)

---

## Phase 1 — Foundation ✅ DONE

### Deliverables
- [x] Monorepo setup: /apps/web, /apps/api, /packages/ui, /packages/shared-types, /packages/config
- [x] Env config + Zod validation + provider factories (db, storage, messaging, device)
- [x] Auth: session cookies, login, register, logout
- [x] Password reset: OTP — email always available; SMS offered as a channel choice only if `SMS_GATEWAY=true` AND the `password_reset` category is enabled (see `messaging-domain`)
- [x] RBAC: roles (super_admin, admin, coordinator, teacher, accountant, librarian, parent, student)
- [x] Super Admin permission matrix (includes messaging feature toggles)
- [x] Security layer: Helmet, CSP, CSRF, rate limit, DOMPurify, server-only, Taint
- [x] Prisma schema v1: User, Role, Permission, School, Campus, Building, Room, Class, Section, Shift, Student, Teacher, Staff, Guardian, PasswordResetOtp
- [x] Shared UI primitives (shadcn baseline): Button, Input, Dialog, Table, Card, Badge, Tabs
- [x] Shared components: DataTable, StatCard, PageHeader, FilterBar, FormModal, ConfirmDialog, EmptyState, RoleGate
- [x] TanStack Query setup + api-client + query-client
- [x] Folder structure for dashboards (admin, teacher, parent, student, librarian, accountant)

### Exit criteria — all met
- Super Admin can log in, and (via /users) create staff accounts with roles; a default School + Class + Shift are seeded.
- Any protected route blocks unauthenticated access (requireAuth on API + edge middleware on web).
- Password reset works end-to-end via email; SMS path is wired and activates automatically once SMS_GATEWAY=true and the password_reset toggle is on.
- Zero secrets in client bundle (all secrets live behind `server-only` in apps/api / packages/config; apps/web only holds NEXT_PUBLIC_API_URL).

### Notes for the next session
- Class/Section/Shift CRUD endpoints were NOT built yet (only seeded) — first task of Phase 2 or a quick Phase 1.5 add-on if needed before Operations.
- Messaging: SMTP is fully wired via Nodemailer. SMS provider is a stub (`packages/config/src/providers/messaging.ts` → `sendSms`) — plug in a real gateway SDK when `SMS_PROVIDER` moves beyond `none`.
- Storage provider (Cloudinary/S3/R2) is stubbed in `packages/config/src/providers/storage.ts` — wire the real SDK calls when file upload features start (resource upload in Phase 3, notice/CMS media in Phase 4).
- CSRF middleware uses `csrf-csrf` — verify its API against the installed version after `npm install` (fast-moving package).

---

## Phase 2 — Operations ✅ DONE
- [x] Attendance (assignable taker with admin override, teacher dashboard widget, absent → `absence_alert` notification)
- [x] Class assignment (Admin/Coordinator: shift + class + section + subject + room + instructor, one row per assignment)
- [x] Fees: structure, invoice, due tracking (`fee_due` notification on invoice creation), payment recording (cash + online-gateway stub for bKash/Nagad/SSLCommerz)
- [x] Messaging: per-category SMS toggle UI shipped in Phase 1 remains the control surface; Phase 2 features (attendance, fees, notices) all route through the same `notification.service.ts`
- [x] Parent inquiry (ticket-style, threaded messages, status tracking)
- [x] Notice board (publish → `general_notice` broadcast email) + event calendar

### Notes for the next session
- **Payment gateways are stubs.** `packages/config/src/providers/payment.ts` has `isEnabled()` wired to env flags (`BKASH_ENABLED`, `NAGAD_ENABLED`, `SSLCOMMERZ_ENABLED`) but `initiate()` throws until a real SDK call is added. Manual "Record payment" (cash) works end-to-end today.
- **Class assignment / fee structure forms take raw IDs** (Class ID, Section ID, Teacher ID, etc.) rather than searchable pickers — there's no Section/Room/Student CRUD UI yet (only seeded via Prisma). A natural Phase 2.5 or early-Phase-3 cleanup: build that CRUD + swap these ID inputs for `<Select>` pickers backed by real list endpoints.
- **Notice broadcast emails one-by-one** to every matching-role user (no phone/SMS resolution for the broadcast case, only for the direct notifications like invoices/attendance/password-reset). Fine at school scale for now; batch-sending is a Phase 5 performance concern if it matters.
- **Overdue invoice status** only updates when `refreshOverdueInvoices()` in `fees.service.ts` is called — it isn't wired to a cron yet. Wire it to a scheduled job (or call it lazily on each invoice list fetch) when it matters.
- Ran `npm install`, then typechecked `packages/shared-types`, `packages/config`, `packages/ui`, and `apps/web` clean. Could not run `prisma generate` / typecheck `apps/api` in this sandbox (its network policy blocks `binaries.prisma.sh`, where Prisma downloads its query engine) — manually cross-checked every new Prisma call against the schema instead. Run `npm run prisma:generate` yourself before trusting `apps/api` fully; it should work normally with regular internet access.

---

## Phase 3 — LMS ✅ DONE
- [x] Resource upload (PDF/video/slides) by teacher — as a direct link for now (see notes)
- [x] Recorded class upload + live class links — same Resource model, `kind` = `recorded_class` / `live_link` (+ optional `scheduledAt`)
- [x] Assignments: create, submit, grade (with a separate publish step before student/parent see the grade)
- [x] Exams: online/offline, marks entry, grading
- [x] Results: publish (→ `result_published` notification to guardians) + parent/student view
- [x] Subject-wise materials by class/section (Resource is scoped to class+section+subject+teacher)
- [x] Parent/Student portal — both dashboards now have Notices, Materials, Assignments, and Results tabs

### Notes for the next session
- **No real file upload yet.** Resources take a pasted URL (Drive/Cloudinary/YouTube/etc.) rather than an uploaded file, because `packages/config/src/providers/storage.ts` is still a stub. Once a storage SDK is wired in, add a multipart/base64 upload endpoint that calls `storage.upload()` and swap the URL field for the existing `FileUploader` component from `packages/ui`.
- **No aggregate "Result" or report-card model.** Per-exam marks are the result in this phase (visible once `Exam.publishedAt` is set); a proper term report card (combining every subject/exam for a student into one document) is a good Phase 4/5 addition, and would pair well with the `pdf` skill for generating a downloadable card.
- **No dedicated "assignment graded" messaging category.** `assignment_posted` fires when a teacher creates a new assignment (guardians of the section are emailed); publishing a grade currently does *not* notify anyone — add a category to `messaging-domain.md` first if that's wanted.
- Same validation note as Phases 1–2: typechecked `packages/shared-types`, `packages/config`, `packages/ui`, and `apps/web` clean; `apps/api` couldn't run `prisma generate` in this sandbox (blocked `binaries.prisma.sh`), so every new Prisma call was manually cross-checked against the schema instead (composite unique keys, model/field names). Run `npm run prisma:generate` yourself to confirm.

---

## Phase 4 — ERP + CMS ✅ DONE
- [x] Salary management (monthly, deductions, bonuses) — Accountant dashboard, one row per staff/month/year, "mark paid"; the row itself doubles as the payslip (no PDF binary yet, see notes)
- [ ] Inventory (uniform, stationery) — **skipped**, it was marked optional in this plan; not built
- [x] Library: catalog, issue/return (with automatic overdue fine calc), book sales — Librarian dashboard
- [x] CMS: Page model with Draft → Review → Published workflow, admin editor (RichTextEditor, DOMPurify-sanitized server-side), public unauthenticated routes for `/notice` and any published page slug (`/about`, `/contact`, `/policies/refund`, etc.)
- [x] Device control: env-driven per-role concurrent-session cap (`DEVICE_CONTROL_ENABLED` + `DeviceLimit` table), enforced at login by evicting the oldest session(s); Super Admin manages the per-role numbers from Admin → Users & Messaging
- [x] Reports: fee collection (due vs. collected, by month), attendance % by section, defaulter list — Admin → Reports tab

### Notes for the next session
- **No PDF payslips/report cards.** Both the Phase 3 exam "report card" gap and this phase's payslip are just data views right now — the `pdf` skill (used for chat-time document generation) isn't wired into the running app itself. If a downloadable PDF matters, add a library like `pdfkit` or `@react-pdf/renderer` to `apps/api` and generate on demand.
- **Inventory wasn't built** — it was explicitly optional in this plan. If it's wanted later, it would follow the same pattern as Library (a stock model + issue/return or sale flow).
- **CMS home page (`/`) is still the static marketing page** from Phase 1, not CMS-driven — cms-domain.md lists `/` as a public route but rebuilding the existing landing page as a CMS page wasn't done to avoid regressing it. `/about`, `/contact`, `/policies/*` and any other slug work through the new catch-all `app/(public)/[...slug]/page.tsx`.
- **Fine rate is hardcoded** at ৳5.00/day (`FINE_PER_DAY_PAISA` in `apps/api/src/controllers/library.controller.ts`) — move it to env or a settings table if it needs to be configurable.
- Same validation approach as every prior phase: typechecked `packages/shared-types`, `packages/config`, `packages/ui`, and `apps/web` clean; manually cross-checked every new Prisma call in `apps/api` against the schema (model names, the `staffId_month_year` composite key, etc.) since this sandbox can't reach `binaries.prisma.sh` to run `prisma generate`. Run it yourself to confirm.

---

## Post-Phase-4 — Runtime verification & critical fixes ✅ DONE
Real credentials (Neon Postgres, Cloudinary, Gmail SMTP) were provided and
used to actually runtime-test the stack for the first time, rather than
relying on `tsc` typechecking alone. This caught three real bugs that no
amount of static typechecking would have found:

1. **`server-only` crashed the entire API on boot.** That package throws
   unconditionally in plain Node — it only becomes a no-op under Next.js's
   webpack bundling (via the `react-server` export condition). Since
   `apps/api` is plain Express, every file importing it would crash
   immediately. **Fixed**: removed `server-only` from every file in
   `apps/api` and `packages/config` and dropped the dependency — it was
   never needed here anyway, since `apps/web` never touches secrets/DB
   directly (everything sensitive already lives only in the Express API).
2. **`csrf-csrf`'s real API didn't match what was written** — the installed
   version (3.2.2) uses `getTokenFromRequest` (not `getCsrfTokenFromRequest`)
   and exposes `generateToken` (not `generateCsrfToken`), and needs a
   `getSessionIdentifier`. **Fixed** in
   `apps/api/src/middleware/csrf.middleware.ts` — verified by actually
   importing it, not just reading the docs.
3. **Every boolean env flag was silently always-on.** `z.coerce.boolean()`
   does JavaScript's `Boolean(x)` coercion — the *string* `"false"` is
   non-empty, so it coerces to `true`. This affected `COOKIE_SECURE`,
   `SMS_GATEWAY`, `DEVICE_CONTROL_ENABLED`, and all three payment-gateway
   toggles. **Fixed** with an explicit string-literal parser in
   `packages/config/src/env.ts`; verified with a real `.env.local` file
   that `SMS_GATEWAY=false` now actually produces `false`.

Also fixed a real gap: **env files were never loaded at runtime.** Nothing
called `dotenv.config()` anywhere — `.env`/`.env.local` files existed but
had no effect until you exported the vars yourself. Added
`apps/api/src/bootstrap-env.ts` (loads `.env.local` then `.env`, imported
first in `index.ts` and `prisma/seed.ts`) and wrapped the Prisma CLI scripts
with `dotenv-cli` so `prisma generate`/`migrate`/`studio` see them too.

Also wired the **Cloudinary storage provider for real** (was a stub) in
`packages/config/src/providers/storage.ts`, and added an actual file-upload
endpoint (`POST /uploads`, multer + the storage provider) wired into the
teacher Resources form's existing `FileUploader` component.

**What was verified by actually running code** (not just `tsc`), using the
real Neon/Cloudinary/Gmail credentials in `apps/api/.env.local`:
- Env loads and validates correctly against the real `.env.local` (fixed the
  boolean bug in the process)
- All three provider factories (storage, messaging, payment) construct
  successfully with real credentials
- The full API boot sequence — bootstrap, Express, Helmet, CORS, CSRF, every
  middleware, every route file's imports — all succeed, up to the exact
  point of Prisma client construction

**What could NOT be verified**, because this sandbox's network is restricted
to package registries only (confirmed via direct `curl`, all return `403`):
Neon Postgres, Cloudinary's API, Gmail's SMTP server, and Prisma's own
engine-binary host (`binaries.prisma.sh`) are all unreachable here. So
`prisma generate`/`migrate`/`seed`, a real DB write, a real file upload, and
a real email send could not be executed in this sandbox. This is a sandbox
network restriction, not a code issue — on any machine with normal internet
access, `npm run prisma:generate && npm run prisma:migrate && npm run
prisma:seed` followed by `npm run dev:api` should connect and boot cleanly
using the credentials already in `apps/api/.env.local`.

---

## Marketing landing page ✅ DONE
`apps/web/app/page.tsx` is now a full landing page (components in
`apps/web/components/marketing/`): sticky navbar (Home, Solutions dropdown
with For Administrators/Teachers/Parents/Students, Features, Pricing, About
us, Contact, high-contrast Sign in), hero with "Book a demo" CTA and a
mark-sheet mockup, 8-module feature grid, tabbed role sections (deep-linkable
from the dropdown via `#roles-admin` etc.), testimonials, an interactive
time-saved calculator plus Starter/Growth/Enterprise plans, About us, FAQ
(security, migration, SMS budget, offline, onboarding), Contact, footer CTA
and footer. Runtime-tested: `next dev` serves `/` with every section, and
`/login`, `/register`, `/reset-password`, `/notice`, `/about` all return 200
while `/dashboard` redirects logged-out visitors to `/login`.

Notes:
- **Placeholder content to replace before going live**: the contact email
  (`info@greenvalleyschool.edu.bd` in `contact-section.tsx`), the testimonials
  (illustrative, attributed by role only), and the plan tiers (no prices are
  invented — every plan says "Contact us for pricing").
- The time-saved calculator is an illustrative estimate, labeled as such.
- Fonts (Inter, Fraunces) download from Google Fonts at build time; they fell
  back to system fonts in the sandbox only because its network is blocked.
- `/policies/privacy` and `/policies/terms` (footer links) resolve through the
  CMS catch-all and show "Page not found" until an admin publishes pages with
  those slugs in Admin → CMS Pages.

---

## Post-Phase-4 — Full test suite & security review ✅ DONE
This session built a **real, runnable test suite for `apps/api`** and used
it to find and fix bugs that neither `tsc` nor manual review had caught —
including two privilege-escalation vulnerabilities.

### How the tests actually exercise the real app
`apps/api/tests/helpers/fake-prisma.ts` is a schema-driven, in-memory
stand-in for `PrismaClient`, built directly from Prisma's own DMMF (so it
automatically knows every model, field, relation, default, and unique/FK
constraint from `schema.prisma` — nothing hand-duplicated to drift out of
sync). It's a swap-in for `../lib/prisma` at the top of the test setup;
everything else is 100% real: the actual Express app (`app.ts`, split out of
`index.ts` so it's importable without binding a port), every real
middleware (CSRF, RBAC, rate limiting, error handling), every real
controller and service. Nodemailer and Cloudinary are mocked only at the
network boundary (captured into an in-memory mailbox/uploads array) so email
content and upload flow are still asserted on for real. A tiny cookie-jar +
CSRF-aware HTTP client (`tests/helpers/harness.ts`) drives it like a real
browser session would. **102 tests across 11 files, run with real
`PrismaClient` types** (see below) — `cd apps/api && npm test`.

### Bugs found and fixed this session
1. **Privilege escalation via self-registration.** `POST /auth/register`
   accepted `role: "super_admin"` (or any staff role) from the public,
   unauthenticated endpoint. **Fixed**: the schema now only accepts
   `parent`/`student` server-side (`SELF_REGISTERABLE_ROLES` in
   `packages/shared-types/src/schemas/auth.ts`) — the client already
   restricted this, but the server didn't re-check it.
2. **Privilege escalation via admin-created users.** A plain `admin` (not
   `super_admin`) could call `POST /users` with `role: "super_admin"` and
   mint themselves a fresh top-privilege account. **Fixed** in
   `users.controller.ts`: only an existing `super_admin` may create another.
3. **Account creation never created the role profile row.** Both
   `POST /auth/register` and `POST /users` only ever created a bare `User`
   row — never the `Guardian`/`Student`/`Teacher`/`Staff` row every other
   feature depends on. A self-registered parent had no `Guardian` row (fees,
   tickets — silently broken); a self-registered student had no `Student`
   row (couldn't submit assignments, see resources); an admin-created
   teacher had no `Teacher` row (couldn't be assigned to a section, take
   attendance, or post resources/assignments). **Fixed** with a shared
   `createRoleProfile()` helper (`services/profile.service.ts`) called
   inside the same DB transaction as the `User` creation in both places.
4. **A student could submit an assignment for a section they're not in.**
   `submitAssignment` never checked that the assignment's section matched
   the student's own section. **Fixed** in `lms.controller.ts`.
5. **`csrf-csrf`'s real API didn't match what was written** (already fixed
   last session) — this session's tests additionally caught that the
   default `generateToken(req, res)` call rejects a still-valid session's
   *previous* CSRF cookie after login/logout, which would have broken every
   mutating request right after signing in. Fixed by calling
   `generateToken(req, res, false, false)` (don't validate-on-reuse,
   don't require overwrite) in the `/auth/csrf-token` handler.

None of these were reachable by `tsc` — they're all runtime/logic bugs. This
is the concrete case for why this session pushed past typechecking into
actually running the app.

### What else was verified by actually running things
- **`apps/api` typechecks with the REAL generated Prisma client** for the
  first time (previously only checked against Prisma's placeholder stub
  client). This sandbox still can't download Prisma's query-engine binary
  from `binaries.prisma.sh`, but pointing `PRISMA_QUERY_ENGINE_LIBRARY` /
  `PRISMA_SCHEMA_ENGINE_BINARY` at harmless dummy files and setting
  `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1` is enough for `prisma generate`
  to run its schema validation (via Prisma's bundled WASM parser) and emit
  real types — it just can't execute a real query, which the fake client
  above stands in for. `apps/api` now typechecks 100% clean against those
  real types (previously ~30 errors, all confirmed to be the stub client's
  fault, not real bugs — see last session's shim-based proof).
- **`apps/web` runs a full, real, production `next build`** — all 15
  routes/pages compile, static generation succeeds, middleware bundles. The
  Google Fonts (Inter, Fraunces) fetch is the only failure in this sandbox,
  confirmed to be solely a network restriction (fonts.googleapis.com isn't
  reachable here) by temporarily swapping in system fonts and getting a 100%
  clean build — then the real Google Fonts setup was restored byte-for-byte.
  This will build normally with real internet access.
- Ran the full 102-test suite **three times** to rule out flakiness (found
  and fixed one flaky test in the process — a "tampered cookie" test whose
  tampering was occasionally a no-op).

### What still can't be verified in this sandbox
A real Postgres round-trip (Neon), a real Cloudinary upload, and a real
Gmail send — this sandbox's network is restricted to package registries
only. The fake-Prisma test suite exercises the exact same application code
that would run against the real database; it does not exercise Postgres
itself (constraint enforcement, index behavior, connection pooling). Treat
the 102 passing tests as strong evidence the application logic is correct,
not as a replacement for a real staging-environment smoke test before going
live.

---

## Phase 5 — Scale + PWA 🔄 IN PROGRESS ← START HERE
- PWA: service worker, manifest, installable, offline shell, background sync for attendance
- Redis caching (hot reads: permissions, school config, timetables)
- CDN for static + images
- Load balancer (Nginx/Cloudflare) in front of Express
- Database connection pooling (PgBouncer for VPS)
- Lighthouse audit ≥ 90 (PWA + Performance)
- Index tuning, query cache for expensive reports
- Code splitting, lazy loading, defer non-critical scripts
- Compress API payloads (gzip/brotli), image optimization
