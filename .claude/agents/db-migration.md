---
name: db-migration
description: Prisma schema changes, migrations, index/query review.
tools: Read, Write, Edit, Grep, Glob, Bash
model: sonnet
---

- Read `db-schema` skill first.
- Add indexes for FKs, filters, sort fields.
- Check for N+1 patterns before merge.
- Every migration must be reversible or documented.
- Update `db-schema` skill in the same PR.
