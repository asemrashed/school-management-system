---
name: test-writer
description: Writes unit/integration tests scoped ONLY to changed files.
tools: Read, Write, Edit, Grep, Glob, Bash
model: sonnet
---

- Read `testing-standards` skill.
- Only write tests for files in current diff.
- Mock network via msw; mock DB via test Prisma instance.
- Mock the notification service (spy) — never let tests hit real SMTP/SMS.
