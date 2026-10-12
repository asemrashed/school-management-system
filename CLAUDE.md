# CLAUDE.md — Router

You are working on **BD English-Medium School Management System** (LMS + ERP + CMS).
Target: English-medium schools in Bangladesh. **Single school, not multi-tenant.** Env-driven providers. Low-token workflow.

## Stack
Next.js (App Router), Express, Prisma, PostgreSQL (Neon default / VPS-local prod),
TanStack Query (single source of truth for client data), Zustand, shadcn/ui,
Zod (client + server), DOMPurify, server-only, Helmet, Nodemailer (SMTP),
optional SMS gateway (env toggle), storage: Cloudinary default / S3 / R2.

## Rules (NEVER skip)
- Zod for ALL input validation (client + server, shared schemas).
- DOMPurify for ALL user-generated HTML (client + server, before DB write).
- `server-only` for ANY file touching DB, secrets, or Prisma.
- NEVER send secrets or Prisma objects to client.
- NEVER load confidential data without auth middleware check.
- All providers (db, storage, sms, devices) resolved from env at boot via factories.
- All list endpoints MUST support server-side pagination (cursor for large, offset for small).
- All shared UI lives in /packages/ui — dashboards IMPORT, never OWN.
- All SMTP/SMS sends go through ONE notification service — never inline provider calls.

## 📖 Read First (every session)
1. `MASTER_PLAN.md` → read top 3 lines → jump to current phase ONLY.
2. Never re-read completed phases.

## 🛠️ When to use SKILLS (load ONLY when relevant)
- Any UI work (new page, dashboard, component)? → `component-registry` FIRST, then `ui-component-library`
- Prisma / queries? → `db-schema`, then domain skill
- Shared types / DTOs FE↔BE? → `api-contract`
- Auth / XSS / CSRF / headers? → `auth-rbac-matrix`
- Errors / logs / HTTP status? → `error-handling-logging`
- LMS features (attendance, grading, exams)? → `lms-domain`
- ERP features (fees, salary, library)? → `erp-domain`
- CMS features (pages, blocks, publishing)? → `cms-domain`
- SMTP/SMS, OTP channel, per-feature notification toggles? → `messaging-domain`
- Folder/naming/imports? → `project-conventions`
- Tests? → `testing-standards`
- PWA / offline / manifest / service worker? → `pwa-standards`

## 🤖 When to use AGENTS
- New page/dashboard BEFORE coding → `ui-architect` (returns REUSE/CREATE plan)
- Schema change / migration / index review → `db-migration`
- New endpoint → `backend-api`
- New component/page → `frontend-ui` (after ui-architect)
- Cross-domain contracts (LMS↔ERP↔CMS) → `architect`
- Auth flows / permission enforcement → `auth-rbac`
- Pre-merge review (duplication, SOLID, security) → `code-reviewer`
- Tests for changed files → `test-writer`
- CI/CD, env, deploy → `devops`

## 🚫 Never
- Read completed phases in MASTER_PLAN.
- Load files unrelated to current task.
- Create a component before checking `component-registry`.
- Duplicate types — always import from `@packages/shared-types`.
- Write component variants per role — use `RoleGate` or `role` prop.
- Inline SMTP/SMS provider calls — always via the notification service (`messaging-domain`).
- Put rules here >100 lines — push detail into Skills.

## 🔭 Out of Scope (do not build)
- Multi-tenant / multi-school SaaS — this is single-school
- Alumni tracking, biometric/RFID attendance, GPS transport tracking
- Multi-currency, full e-resource library licensing
- Advanced BI dashboards, complex teacher appraisal
- Govt / Bangla-medium-specific tooling

## 📁 Folder Map
/apps/web        → Next.js (all dashboards: admin, teacher, parent, student, librarian, accountant)
/apps/api        → Express + Prisma
/packages/ui     → ALL shared components
/packages/shared-types → Zod schemas + DTOs (FE↔BE contract)
/packages/config → env, provider factories
/.claude/agents  → scoped agents
/.claude/skills  → on-demand knowledge
