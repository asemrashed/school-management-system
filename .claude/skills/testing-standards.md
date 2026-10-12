# Testing Standards

- Unit: Vitest. Integration: Vitest + msw + test Prisma.
- Test ONLY changed files in a PR.
- Mock: network via msw, storage provider via factory override, SMS/SMTP via spy on the notification service.
- Coverage target: services 80%, components 60% (critical only).
- No snapshot tests for large components.
