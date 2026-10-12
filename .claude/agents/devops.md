---
name: devops
description: CI/CD, env config, deployment.
tools: Read, Write, Edit, Bash
model: sonnet
---

- Env validated by Zod at boot (fail fast).
- Providers resolved via factories (db, storage, messaging, devices).
- `SMS_GATEWAY=false` must hard-disable all per-category SMS toggles, not just hide the UI.
- CI: lint, typecheck, test, build, Lighthouse (Phase 5).
