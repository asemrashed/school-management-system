# BD English-Medium School Management System

LMS + ERP + CMS for a single English-medium school in Bangladesh. See `CLAUDE.md`
for the working rules and `MASTER_PLAN.md` for phase-by-phase progress.

**Phases 1–4 are complete** (Foundation, Operations, LMS, and ERP + CMS).
That's auth/RBAC, attendance, fees, LMS (resources/assignments/exams), plus
now salary management, a full library module, a CMS with public pages, a
device-control cap, and admin reports.

> **Runtime-verified, not just typechecked.** Using real Neon/Cloudinary/Gmail
> credentials, this was actually run (not just type-checked) far enough to
> catch and fix three real bugs — a `server-only` package that crashed the
> whole API on boot, a `csrf-csrf` API mismatch, and a boolean-parsing bug
> that made every `_ENABLED`/`_GATEWAY` env flag silently always-on. See the
> "Post-Phase-4 — Runtime verification" section in `MASTER_PLAN.md` for the
> full writeup. `apps/api/.env.local` and `apps/web/.env.local` are already
> filled in and ready to go.

## Stack
- **apps/web** — Next.js 14 (App Router), TanStack Query, Tailwind, shadcn-style UI
- **apps/api** — Express + Prisma + PostgreSQL
- **packages/ui** — shared component library (shadcn baseline + app components)
- **packages/shared-types** — Zod schemas shared FE↔BE
- **packages/config** — env validation + provider factories (db/storage/messaging/device)

## 1. Prerequisites
- Node.js ≥ 18.18
- Normal internet access for the one-time `prisma generate`/`migrate` step
  (see step 4) — it downloads Prisma's query engine and connects to Postgres
- A PostgreSQL database — `apps/api/.env.local` already points at a real Neon
  database; swap `DATABASE_URL` for your own if you'd rather use a different one
- An SMTP account for sending mail — Gmail SMTP is already configured in
  `apps/api/.env.local`; swap in your own `SMTP_*` values if you'd rather

## 2. Install dependencies
From the repo root (this installs all workspaces at once):

```bash
npm install
```

## 3. Environment variables — already configured

`apps/api/.env.local` and `apps/web/.env.local` are already created and
filled in with real credentials (Neon Postgres, Cloudinary, Gmail SMTP) —
**they're gitignored, never commit them.** You shouldn't need to touch them
to get running. If you ever need to start fresh:

```bash
cp apps/api/.env.example apps/api/.env.local
cp apps/web/.env.example apps/web/.env.local
```

then fill in `apps/api/.env.local`:
- `SESSION_SECRET` — generate one with `openssl rand -base64 48`
- `DATABASE_URL` — your Postgres connection string
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` — your SMTP creds
- `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`
- Leave `SMS_GATEWAY=false` unless you have a real SMS gateway to wire up

## 4. Set up the database

**Requires normal internet access** (this step downloads Prisma's query
engine and connects to your real Postgres — it won't work from a locked-down
sandbox):

```bash
npm run prisma:generate
npm run prisma:migrate     # creates tables, prompts for a migration name
npm run prisma:seed        # creates a default school + Super Admin login
```

The seed script prints the Super Admin email/password it created
(defaults to `admin@school.test` / `ChangeMe123!` — override with
`SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD` in `apps/api/.env.local`
before seeding if you want different credentials).

### Optional: demo data and test payments

```bash
npm run prisma:seed:demo     # ~30 demo users (password for all: Qwer4321), routine, fees, results, website content
```

Set `PAYMENT_SANDBOX=true` in `apps/api/.env.local` to try online fee payment with a practice checkout.
Set `STORAGE_PROVIDER=local` to save uploads on disk (`UPLOAD_DIR`, served at `/files`) instead of Cloudinary.

## 5. Run it

In two terminals:

```bash
npm run dev:api    # http://localhost:4000
npm run dev:web    # http://localhost:3000
```

Open http://localhost:3000, sign in with the Super Admin credentials from the
seed step, and you'll land on `/dashboard` → `/dashboard/admin`, where you can
create staff accounts and toggle SMS per messaging category.

## Testing

`apps/api` has a real integration test suite — 102 tests across 11 files
that exercise the actual Express app, real middleware (CSRF, RBAC, rate
limiting), and real controllers/services, using an in-memory stand-in for
the database so it needs no live Postgres connection:

```bash
cd apps/api
npm test
```

This suite is how several real bugs were found and fixed, including two
privilege-escalation vulnerabilities (public self-registration could set
`role: "super_admin"`; a plain admin could mint a new super_admin account)
and a gap where account creation never created the matching
Guardian/Student/Teacher/Staff profile row. Full write-up in
`MASTER_PLAN.md` under "Post-Phase-4 — Full test suite & security review."

`apps/web` builds cleanly with a real `npm run build` (all routes compile,
static pages generate) — verify anytime with `cd apps/web && npm run build`.

## What's implemented in Phase 1
- Session-cookie auth (httpOnly, signed, DB-backed — instantly revocable)
- Register / Login / Logout, `/auth/me`
- Password reset by email; SMS is offered as a channel choice automatically
  once `SMS_GATEWAY=true` **and** the Super Admin turns on the `password_reset`
  toggle in the admin dashboard — until then, users only see email
- RBAC middleware (`requireRole`, `requirePermission`) backed by a runtime
  `Permission` table Super Admin can edit
- CSRF protection (double-submit cookie), Helmet + CSP, rate limiting on
  auth-sensitive routes
- A single `notification.service.ts` — no route or domain service ever calls
  SMTP/SMS directly
- Shared UI kit in `packages/ui` matching `component-registry.md`
- Dashboard shells for all 8 roles, with role-gated navigation

## What's implemented in Phase 2
- **Attendance**: teacher dashboard widget marks a whole section at once;
  admin/coordinator can delegate the "attendance taker" per section; marking
  a student absent fires an `absence_alert` to their guardian automatically
- **Class assignments**: one row = shift + class + section + subject + room
  + instructor, managed from Admin → Class Assignments
- **Fees**: fee structures (per class/shift/year), invoices, and payments
  (cash works end-to-end; bKash/Nagad/SSLCommerz are wired as env-gated
  provider stubs — see below); invoice status (unpaid/partial/paid/overdue)
  computes automatically as payments come in
- **Notices**: rich-text notices with an audience picker; publishing emails
  everyone in that audience via the same `notification.service.ts`
- **Events**: a simple school-wide event calendar
- **Parent inquiry tickets**: threaded, ticket-style support requests with
  status tracking (open/in progress/resolved)

## What's implemented in Phase 3
- **Resources**: teachers publish subject-wise materials (PDF/video/slides),
  recorded classes, and scheduled live-class links, scoped to a class +
  section + subject; students/parents only ever see published ones
- **Assignments**: teachers post an assignment to a section; students submit
  a written answer and/or a file link; teachers grade and choose when to
  publish the grade (students/parents see nothing until published)
- **Exams & results**: teachers create an exam, enter marks for the whole
  section at once, then publish — which locks the marks and emails/SMSes
  every guardian their child's score (`result_published`)
- Teacher dashboard now has tabs for Attendance / Resources / Assignments /
  Exams; Student dashboard has Notices / Materials / Assignments / Results;
  Parent dashboard gained a Results tab

## What's implemented in Phase 4
- **Salary**: Accountant creates a monthly salary run per staff member
  (base, deductions, bonuses → net), marks it paid; each staff member's own
  payslip rows are visible to them via the same endpoint (scoped server-side)
- **Library**: Librarian dashboard — catalog with lending + optional sale
  price, issue/return with an automatic overdue fine, and a book-sales log
- **CMS**: Admin → CMS Pages manages a Draft → Review → Published workflow
  with a rich-text editor; published pages are publicly viewable, no login
  needed, at `/<slug>` (e.g. `/about`, `/policies/refund`) and there's a
  public `/notice` board too
- **Device control**: Super Admin sets a max-concurrent-sessions number per
  role in Admin → Users & Messaging; when `DEVICE_CONTROL_ENABLED=true`, a
  new login evicts the oldest session(s) once a role's cap is hit
- **Reports**: Admin → Reports — fee collection (due vs. collected by
  month), attendance % by section, and a defaulter list of unpaid/overdue
  invoices

## What's stubbed or skipped, on purpose
- **SMS provider**: `packages/config/src/providers/messaging.ts` throws until
  you wire in a real gateway SDK. SMTP (Gmail, already configured) is fully
  functional.
- **File upload is real, not a stub.** `packages/config/src/providers/storage.ts`
  has a working Cloudinary implementation (credentials already in
  `apps/api/.env.local`), and `POST /uploads` (multer → Cloudinary) is wired
  into the teacher Resources form's `FileUploader`. Switching
  `STORAGE_PROVIDER` to `s3`/`r2` still needs those SDK calls added — only
  Cloudinary is implemented.
- **Payment gateways**: online payment is built end to end (start → gateway → confirm → receipt).
  `PAYMENT_SANDBOX=true` gives a practice checkout with no real money. SSLCommerz is implemented but untested against a real store;
  **bKash and Nagad live checkout are not wired** (they need your merchant account and their signed API flow). Cash/office payments work.
- **Admin screens cover setup, students, fees and the website.** Class/section/room CRUD, student admission, fee structures and the public site are all editable in the UI with searchable dropdowns (no IDs).
- **No PDF generation.** Payslips and exam results are data views, not
  downloadable documents — there's no aggregate "Result"/report-card model
  either (per-exam marks are the result for now). Add `pdfkit` or similar to
  `apps/api` if a real downloadable document matters.
- **Inventory (uniform/stationery) was skipped** — it was marked optional in
  `MASTER_PLAN.md`. It would follow the same pattern as the Library module.
- **The public site is settings-driven.** Home (single page), About, Admission, Gallery and Contact are edited under Admin → Website and CMS Pages. Other CMS slugs still work through the catch-all route.
- **Library fine rate is hardcoded** (৳5/day) in
  `apps/api/src/controllers/library.controller.ts`.

## Monorepo scripts (from repo root)
| Script | What it does |
|---|---|
| `npm run dev:web` / `dev:api` | Start each app in dev mode |
| `npm run build:web` / `build:api` | Production builds |
| `npm run prisma:generate` / `prisma:migrate` / `prisma:seed` | Prisma workflow (proxies into apps/api) |
| `npm run typecheck` | Type-check both apps |
| `npm run test` | Run the apps/api integration test suite (102 tests, no DB needed) |
| `npm run lint` | Lint both apps |

## Project structure

```
/apps/web            Next.js App Router — all role dashboards
/apps/api            Express + Prisma REST API
/packages/ui         Shared component library
/packages/shared-types  Zod schemas + inferred types (the FE↔BE contract)
/packages/config     Env validation + provider factories
/.claude/agents      Scoped agent instructions (used by Claude Code sessions)
/.claude/skills      On-demand domain knowledge (used by Claude Code sessions)
CLAUDE.md            Router — read this first in any new session
MASTER_PLAN.md       Phase-by-phase plan and progress
```

## Next up: Phase 5 — Scale + PWA
See `MASTER_PLAN.md` for the full list (service worker/offline shell, Redis
caching, CDN, load balancing, connection pooling, Lighthouse tuning). Start a
new session, point it at `CLAUDE.md`, and it will pick up Phase 5
automatically.
