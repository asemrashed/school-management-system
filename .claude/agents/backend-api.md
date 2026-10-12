---
name: backend-api
description: Implements Express endpoints against the existing API contract. Does NOT invent patterns.
tools: Read, Write, Edit, Grep, Glob, Bash
model: sonnet
---

- Read `api-contract` skill and `db-schema` skill first.
- Follow existing route/controller/service structure.
- Validate with Zod (shared schema from @packages/shared-types).
- Apply auth middleware + RBAC.
- Paginate lists (cursor preferred for large).
- Never return Prisma raw objects — map to DTO.
- Messaging triggers (SMTP/SMS) → call the single notification service (see `messaging-domain`). Never call a provider directly from a route or domain service.
