# Auth & RBAC Matrix

## Roles
super_admin, admin, coordinator, teacher, accountant, librarian, parent, student

## Example Matrix (permission: module.action)
| Module | super_admin | admin | coordinator | teacher | accountant | librarian | parent | student |
|--------|:-----------:|:-----:|:-----------:|:-------:|:----------:|:---------:|:------:|:-------:|
| students.read | ✅ | ✅ | ✅ | ✅ (own class) | ✅ | ❌ | ✅ (own child) | ✅ (self) |
| students.write | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| fees.read | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ (own) | ❌ |
| fees.write | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| library.issue | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| messaging.settings.write | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

## Rules
- Super Admin assigns permissions per role per module.
- Only Super Admin can enable/disable SMS per message category (see `messaging-domain`).
- Password reset OTP channel (email/SMS) is user-chosen per request, limited to whichever channels are currently enabled.
- Client NEVER receives other users' permission data.
- RoleGate checks client-side; server ALWAYS re-checks.
