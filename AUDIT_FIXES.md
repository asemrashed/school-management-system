# Authorization / data-scope audit — fixes

All changes are covered by `apps/api/tests/11-authorization-hardening.test.ts` (120 API tests pass; API and web typecheck clean).

## Fixed
| Finding | Fix |
|---|---|
| Parent got Accountant/Fees (+Salary) page; student got Teacher page | `apps/web/lib/role-routes.ts` is the single source for sidebar, login landing and a route guard in `dashboard/layout.tsx`. Parent -> `/dashboard/parent`, student -> `/dashboard/student`. Salary API also closed to parent/student. |
| Teacher reaches/modifies other sections | New `apps/api/src/lib/scope.ts`. Roster, attendance, exams, marks, publish, resources, assignments, submissions, grading all require the teacher to be assigned to that section (+subject where relevant). |
| Student/parent widen scope via `?sectionId=` | `resolveSectionFilter` only narrows, never widens (exams, resources, assignments, class assignments). |
| Parent saw all marks / all submissions | Parent/student now get only their own children's rows. |
| Invoices: unlinked student/parent saw everyone's | Scoped to own student ids (empty -> nothing). Online-payment initiation checks ownership. |
| Overpayment / double payment | `recordPayment` is transactional, rejects amount <= 0, > outstanding, or on a paid invoice; optimistic lock on `amountPaid`. |
| Attendance relationship not enforced | Every entry must be an active student of that section; duplicates rejected. |
| Marks | Must be <= exam max, students must be in the exam's section, no duplicates; exam/subject/section consistency checked on create. |
| Notices not audience-scoped | `readableAudiences(role)`; public board shows only `audience = all`. |
| Support tickets readable by any role | Parent (own) + admin tier only. |
| Library: anyone lists all issues | Non-library roles see only their own loans; borrower validated; stock claim is atomic. |
| Uploads: any role, any file | Roles limited to admin tier/teacher/student; extension+MIME allowlist; server-generated filename (no overwrite/path tricks); oversize -> 413. |
| Salary | Staff accounts only; negative net rejected; paid payslips immutable; double-pay rejected. |
| CMS workflow | Coordinators can draft but not publish/edit live pages; slug clash on rename checked. |
| Attendance report | No longer exposed to accountants. |

## Deliberately NOT changed (needs your decision / larger work)
- Runtime `Permission` matrix (`requirePermission`) is still unused — routes use fixed `requireRole`. Wiring it needs a product decision on defaults.
- Schema gaps: enrollment/promotion history, academic-year config, per-student fee discounts/waivers. These need migrations and domain decisions.
- Pagination on list endpoints (invoices, issues, tickets, etc.) — CLAUDE.md requires it, most lists are still unbounded.
- `multer@1.x` has known vulnerabilities — upgrade to 2.x.

## Phase 1 build (academic setup, routine, searchable dropdowns, role limits)

Schema changes (run `npm run prisma:migrate` to create the migration, then `prisma:seed`):
- `Room.buildingId` is now optional (buildings are optional).
- `ClassAssignment.takesAttendance` ("first teacher") + new `Period`, `RoutineSlot`, `AcademicYear`, `RoleAccountLimit`, enum `Weekday`.

New API: `/setup/*` (shifts, classes, sections, buildings, rooms, periods, academic years), `/lookup/:kind?q=` (dropdown search),
`/academics/routine`, `PATCH /academics/class-assignments/:id`, `/academics/subjects/:id` (PATCH/DELETE),
`/attendance/my-sections`, `/role-limits` (Super Admin). Routine clashes (teacher, section, room) return 409 `ROUTINE_CLASH`.
Role limits are enforced on admin-created users and public self-registration (409 `ROLE_LIMIT_REACHED`).

Attendance taker priority: admin override -> assignment flagged `takesAttendance` -> earliest assignment.
Tests: `tests/12-setup-routine-limits.test.ts` (21 tests). The account-limit check runs inside a Serializable transaction, so two simultaneous creations cannot both pass a cap (the loser gets 409 and can retry).

## Phase 2-4 build (admissions, fees, online payment, public website)

Schema (run `npm run prisma:migrate`): `FeeKind` on `FeeStructure` (admission / monthly / other), `Student.studentCode`,
`OnlinePayment` (pending gateway sessions), `AdmissionApplication`, `ContactMessage`, `GalleryImage`, `SiteSetting`,
website profile fields on `Teacher`.

New API: `GET/POST /students`, `POST /students/admit`, `PATCH /students/:id`; `POST /fees/invoices/generate` (monthly billing, safe to re-run);
`GET /fees/payments/options`, online payment start + gateway callback, sandbox completion, receipts, per-invoice payments;
`/site/*` (settings, website teachers, gallery, contact inbox, applications) and public `/public/site|gallery|contact|admission`;
lookups `guardians|feeStructures|staff|users`.

Security notes:
- Admission, role caps and account creation run in Serializable transactions (race fixed, 409 on conflict).
- Online payments: a `Payment` row exists only after the gateway confirms; confirmation is an idempotent compare-and-set, so a
  replayed callback pays once. The sandbox completion endpoint is authenticated, ownership-checked and returns 404 unless `PAYMENT_SANDBOX=true`.
  The unauthenticated gateway callback can never book money in sandbox mode.
- Public forms: honeypot, 8 submissions / 15 min / client, CSRF-exempt only for those two POSTs, visitor text HTML-escaped before it goes into email,
  website URLs limited to http(s) or site-relative paths, only Google Maps embeds are framed.
- Lookup pickers are role-scoped (accountant: students/classes/sections/fees/staff; librarian: users only; teachers: no fee/staff/user lists).

Also added after comparing with an independent build (v3): student/parent **Performance** report and Overview tiles
(`GET /students/:id/performance`, `GET /students/mine`, scoped to own child / assigned section), parent child switcher, teacher **Today** tab
(attendance still to do + today's classes), `past_paper` and `notes` resource kinds, and local-date handling so "today" is right in Dhaka (UTC+6).

Honest limits:
- **bKash and Nagad live checkout are NOT implemented** (they throw "not wired"; each needs your merchant onboarding and their signed API flow).
  SSLCommerz is implemented against its documented API but has never been run against a live or sandbox store account. Use `PAYMENT_SANDBOX=true` to test the whole flow.
- Prisma migrations and `next build` could not be run where this was built (no database / blocked font download). API logic is covered by 191 automated tests on an
  in-memory database. The web app was run in headless Chromium against the real API (demo-seeded, in-memory DB): every tab of the teacher, parent, student,
  super admin, accountant and librarian dashboards loaded with no console or API errors, and these flows passed end to end: teacher Today -> take attendance,
  admit a student from an application, generate monthly fees twice (second run bills nobody), parent online payment via sandbox checkout with receipt,
  and editing the website headline showing on the public home. Not browser-tested: SSLCommerz, email delivery, uploads, mobile layouts.
- The coordinator role lands on the teacher page; the admissions UI lives on the Admin page (Super Admin / Admin only), although the API allows coordinators.
- `multer@1.x` upgrade, list pagination, and the unused `Permission` matrix from the list above are still open.

## CSRF + build fixes
- Web client now clears its cached CSRF token after login/logout/register/password-reset and retries once on `CSRF_INVALID` (token is bound to the session cookie, so a pre-login token was rejected for every create/update).
- `npm run build:api` runs `prisma generate` first; `start` runs via tsx (workspace packages ship TS).
- Existing DB: run `npm run prisma:generate`, `npm run prisma:migrate` (creates an incremental migration), then `npm run prisma:seed`.

## Part 1 — teacher authorization
Teachers were scoped by *section*, so two teachers of one section saw each other's work. Now:
- Assignments and resources: a teacher lists only rows they created (`teacherId`).
- Submissions: list/grade only for own assignments.
- Exams, marks, publish: only (section, subject) pairs the teacher is assigned to.
- Student performance: a teacher sees only results for subjects they teach.
- Attendance read: only the delegated attendance taker.
- Admin-tier roles and students/parents are unchanged. Test: `tests/19-teacher-scope.test.ts`.
