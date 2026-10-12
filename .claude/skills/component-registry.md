# Component Registry

## 🧱 shadcn Primitives (NEVER recreate)
Button, Input, Textarea, Select, Checkbox, Radio, Switch, Dialog, Sheet, Drawer,
Table, Card, Badge, Tabs, Tooltip, Popover, Dropdown, Calendar, Form, Toast, Skeleton.

## 🧩 Shared App Components (/packages/ui)
| Component | Path | Used For |
|-----------|------|----------|
| DataTable | /packages/ui/data-table | ALL list/table views, pagination, sort, filters |
| StatCard | /packages/ui/stat-card | Dashboard KPI cards |
| PageHeader | /packages/ui/page-header | Title + breadcrumb + actions |
| FilterBar | /packages/ui/filter-bar | Search + filters above tables |
| FormModal | /packages/ui/form-modal | Any create/edit dialog |
| ConfirmDialog | /packages/ui/confirm-dialog | Destructive actions |
| EmptyState | /packages/ui/empty-state | No data UI |
| ErrorState | /packages/ui/error-state | Error UI |
| RoleGate | /packages/ui/role-gate | Role-based conditional render |
| LoadingSkeleton | /packages/ui/loading-skeleton | Page/table skeletons |
| Pagination | /packages/ui/pagination | Cursor + offset |
| FileUploader | /packages/ui/file-uploader | Storage provider-agnostic |
| RichTextEditor | /packages/ui/rich-text | CMS + notices |
| OtpChannelPicker | /apps/web/components/auth | Password reset (email/SMS choice) |
| AttendanceWidget | /apps/web/components/attendance | Teacher + Admin |
| FeeStatusBadge | /apps/web/components/fees | Parent + Accountant |
| ResultCard | /apps/web/components/exams | Parent + Student + Teacher |
| UserAvatar | /packages/ui/user-avatar | All dashboards |

## 📋 Rules
- BEFORE creating ANY component → search this file.
- 80% similar → EXTEND with props, do not fork.
- Role differences → RoleGate or `role` prop. NEVER per-role duplicates.
- Rule of Three: 3+ pages → /packages/ui. 2 → consider. 1 → keep local.
- New reusable component → add it here in same PR.
