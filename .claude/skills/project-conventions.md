# Project Conventions

## Folders
/apps/web, /apps/api, /packages/ui, /packages/shared-types, /packages/config

## Naming
- Files: kebab-case (student-table.tsx)
- Components: PascalCase
- Hooks: useXxx
- Services: xxx.service.ts
- Routes: plural (students, fees, exams)

## Imports (order)
1. node builtins
2. external
3. @packages/*
4. @/apps/*
5. relative
6. styles

## Rules
- No default exports except Next.js pages.
- Path aliases only, no ../../.. chains.
- One component per file (small helpers may colocate).
