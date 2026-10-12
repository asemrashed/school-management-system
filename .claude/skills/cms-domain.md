# CMS Domain Rules

- Page → Blocks (hero, text, image, list, form).
- Draft → Review → Published workflow.
- Public routes: /, /about, /contact, /policies/*, /notice.
- Admin edits via /admin/cms.
- Publishing a Notice post triggers the `general_notice` category via notification service (see `messaging-domain`).
- Rich text sanitized with DOMPurify before save + before render.
