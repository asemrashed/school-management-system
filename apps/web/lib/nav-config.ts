import type { Role } from "@packages/shared-types";
import { DASHBOARD_ACCESS } from "./role-routes";

/**
 * The dashboard navigation, in ONE place. Each dashboard page is a group in the
 * sidebar and its sections are the sub-menu under it. A section is a `?tab=`
 * value of that page (see `useUrlTab`), so every sub-menu item is a real URL:
 * refresh, bookmark and back/forward all land on the same screen.
 *
 * The first child is the page's default section (what the page shows with no
 * `?tab=`), so each page's `useUrlTab(..., default)` must match it.
 */
export interface NavChild {
  value: string;
  label: string;
  /** Omit = everyone who can open the page. */
  roles?: Role[];
}

export interface NavGroup {
  href: string;
  label: string;
  icon: "overview" | "admin" | "fees" | "library" | "classes" | "academics" | "children" | "learning";
  allow: Role[];
  children: NavChild[];
}

const A = DASHBOARD_ACCESS;

export const NAV_GROUPS: NavGroup[] = [
  { href: "/dashboard", label: "Overview", icon: "overview", allow: A["/dashboard"], children: [] },
  {
    href: "/dashboard/admin", label: "Administration", icon: "admin", allow: A["/dashboard/admin"],
    children: [
      { value: "users", label: "Users & Messaging" },
      { value: "students", label: "Students & Admissions" },
      { value: "setup", label: "Academic Setup" },
      { value: "assignments", label: "Teacher Assignments" },
      { value: "routine", label: "Routine" },
      { value: "exams", label: "Exams" },
      { value: "results", label: "Results" },
      { value: "limits", label: "Role Limits", roles: ["super_admin"] },
      { value: "notices", label: "Notices" },
      { value: "events", label: "Events" },
      { value: "website", label: "Website", roles: ["super_admin", "admin"] },
      { value: "cms", label: "CMS Pages" },
      { value: "reports", label: "Reports" },
    ],
  },
  {
    href: "/dashboard/accountant", label: "Fees & Salary", icon: "fees", allow: A["/dashboard/accountant"],
    children: [
      { value: "invoices", label: "Invoices" },
      { value: "generate", label: "Generate monthly fees" },
      { value: "structures", label: "Fee structures" },
      { value: "salaries", label: "Salaries" },
      { value: "notices", label: "Notices" },
    ],
  },
  {
    href: "/dashboard/librarian", label: "Library", icon: "library", allow: A["/dashboard/librarian"],
    children: [
      { value: "catalog", label: "Catalog" },
      { value: "issues", label: "Issues" },
      { value: "sales", label: "Sales" },
      { value: "notices", label: "Notices" },
    ],
  },
  {
    href: "/dashboard/coordinator", label: "Academics", icon: "academics", allow: A["/dashboard/coordinator"],
    children: [
      { value: "exams", label: "Exams & Approval" },
      { value: "results", label: "Results" },
      { value: "notices", label: "Notices" },
    ],
  },
  {
    href: "/dashboard/teacher", label: "Classes", icon: "classes", allow: A["/dashboard/teacher"],
    children: [
      { value: "today", label: "Today" },
      { value: "attendance", label: "Attendance" },
      { value: "routine", label: "My Routine" },
      { value: "resources", label: "Resources" },
      { value: "assignments", label: "Assignments" },
      { value: "exams", label: "Exams" },
      { value: "results", label: "Results" },
      { value: "notices", label: "Notices" },
    ],
  },
  {
    href: "/dashboard/parent", label: "My Children", icon: "children", allow: A["/dashboard/parent"],
    children: [
      { value: "overview", label: "Overview" },
      { value: "performance", label: "Performance" },
      { value: "routine", label: "Routine" },
      { value: "fees", label: "Fees" },
      { value: "results", label: "Results" },
      { value: "notices", label: "Notices" },
      { value: "tickets", label: "Support tickets" },
    ],
  },
  {
    href: "/dashboard/student", label: "My Learning", icon: "learning", allow: A["/dashboard/student"],
    children: [
      { value: "overview", label: "Overview" },
      { value: "performance", label: "Performance" },
      { value: "routine", label: "Routine" },
      { value: "notices", label: "Notices" },
      { value: "resources", label: "Materials" },
      { value: "assignments", label: "Assignments" },
      { value: "results", label: "Results" },
      { value: "fees", label: "Fees" },
    ],
  },
];

export function visibleChildren(group: NavGroup, role: Role | undefined): NavChild[] {
  return group.children.filter((c) => !c.roles || (role !== undefined && c.roles.includes(role)));
}
