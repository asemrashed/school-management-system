# Messaging Domain Rules

## Channels
- SMTP (Nodemailer) — always on, cannot be disabled per category.
- SMS — provider adapter, gated by env `SMS_GATEWAY=true`. If false, no category can send SMS regardless of its toggle.

## Categories & Defaults
| Category | SMTP | SMS (if gateway on) |
|---|:---:|:---:|
| registration_credentials | ✅ | ❌ |
| absence_alert | ✅ | ✅ |
| fee_due | ✅ | ✅ |
| exam_schedule | ✅ | ✅ |
| result_published | ✅ | ✅ |
| assignment_posted | ✅ | ❌ |
| general_notice | ✅ | ✅ |
| password_reset | ✅ | ✅ (user-selectable channel) |

## Runtime Toggle (Super Admin only)
- `MessagingFeatureToggle(category, smsEnabled)` — Super Admin can flip SMS per category ON/OFF at runtime (e.g., disable SMS for `exam_schedule`, keep it on for `fee_due`).
- Effective SMS availability for a category = `SMS_GATEWAY env` AND `category.smsEnabled`. Both must be true.
- SMTP is the always-on safety channel and is never exposed as a toggle.

## Password Reset OTP
- If SMS is effectively available for `password_reset` → show the user an Email/SMS channel picker at reset-request time.
- Otherwise → send via email automatically, no picker shown.
- OTP: 6-digit, expires 10 min, rate-limited (max 3 requests / 15 min / account). Store only a hash of the code (see `db-schema`).

## Implementation Rule
- ALL messaging sends go through ONE `notification.service.ts` (category, recipient, payload) → it resolves channel(s), never the caller.
- Route handlers and domain services (ERP, LMS, CMS) call the service — they never touch SMTP/SMS providers directly.
- New category → register it here + in `MessagingFeatureToggle` seed data in the same PR.
