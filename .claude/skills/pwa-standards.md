# PWA Standards (Phase 5)

## Goal
Installable app, offline shell, background sync for attendance, push for notices.

## Manifest
- name, short_name, start_url=/dashboard, display=standalone, theme_color, icons (192, 512, maskable).

## Service Worker (Workbox)
- Precache: app shell, fonts, icons.
- Runtime cache:
  - API GET → NetworkFirst (fallback cache) for read-heavy (students, notices).
  - Static assets → CacheFirst, 30 days.
  - Images → StaleWhileRevalidate.
- NEVER cache: auth, payments, mutations, sensitive endpoints.

## Offline
- Offline page for unauthenticated shell.
- Attendance offline → IndexedDB queue → Background Sync → flush on reconnect.
- Show "Offline" badge; disable non-syncable actions.

## Push
- Web Push for categories: `general_notice`, `result_published`, `fee_due` (same categories as `messaging-domain`).
- Requires user opt-in. Store subscription server-side.

## Performance budget (Lighthouse ≥ 90)
- PWA: installable, offline-capable, HTTPS, manifest, SW registered.
- Performance: LCP < 2.5s, CLS < 0.1, INP < 200ms.

## Security
- HTTPS only. No caching of authenticated responses across users.
- Scope SW to app only.
