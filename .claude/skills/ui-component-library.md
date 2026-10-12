# UI Component Library Rules

## Role-Based Conditional Rendering (canonical pattern)
❌ NEVER:
- /admin/StudentTable.tsx
- /teacher/StudentTable.tsx

✅ ALWAYS:
- /packages/ui/student-table.tsx
- Accepts `role` prop + optional `permissions` prop
- Uses <RoleGate allow={['admin']}> for action buttons
- Field-level `canEdit` checks for inputs

## Rule of Three
3+ pages → /packages/ui. 2 → consider. 1 → keep local.

## Data Components
- Lists → DataTable only.
- KPIs → StatCard only.
- Modals → FormModal / ConfirmDialog only.

## States
- Loading → LoadingSkeleton.
- Empty → EmptyState.
- Error → ErrorState.
