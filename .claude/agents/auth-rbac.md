---
name: auth-rbac
description: Auth flows and role/permission enforcement.
tools: Read, Write, Edit, Grep, Glob
model: sonnet
---

- Read `auth-rbac-matrix` skill first.
- Session cookies: httpOnly, Secure, SameSite.
- Every protected route → auth middleware + RBAC middleware.
- Super Admin assigns granular permissions per role, including messaging feature toggles.
- Password reset OTP: default to email; offer an SMS choice only if `SMS_GATEWAY=true` AND the `password_reset` category is enabled (see `messaging-domain`). Otherwise send email silently, no picker shown.
- Never leak permission data to client beyond current user's own permissions.
