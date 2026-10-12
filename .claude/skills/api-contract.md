# API Contract

Single source of truth: `/packages/shared-types` (Zod schemas → inferred types).

## Rules
- FE and BE import DTOs from the SAME file. No local type copies.
- Every endpoint: request schema + response schema.
- Pagination shape: { items, nextCursor?, total? }
- Errors: { code, message, details? } — see error-handling-logging.
- Naming: camelCase JSON, kebab-case URLs, plural routes.
