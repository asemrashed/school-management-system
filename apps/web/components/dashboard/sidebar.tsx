"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BookOpen, ChevronDown, GraduationCap, LayoutDashboard, MessageSquareText, Users, Wallet, School,
} from "lucide-react";
import type { Role } from "@packages/shared-types";
import { NAV_GROUPS, visibleChildren, type NavGroup } from "@/lib/nav-config";

const ICONS: Record<NavGroup["icon"], React.ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  admin: Users,
  fees: Wallet,
  library: BookOpen,
  classes: MessageSquareText,
  academics: School,
  children: Users,
  learning: GraduationCap,
};

/** The groups this role may open, each with the sub-menu items it may see. */
function useNav(role: Role | undefined) {
  const pathname = usePathname();
  const params = useSearchParams();
  const groups = React.useMemo(
    () =>
      NAV_GROUPS.filter((g) => role && g.allow.includes(role)).map((g) => ({ group: g, children: visibleChildren(g, role) })),
    [role]
  );
  const activeHref = groups.find((g) => g.group.href !== "/dashboard" && (pathname === g.group.href || pathname.startsWith(`${g.group.href}/`)))?.group.href
    ?? (pathname === "/dashboard" ? "/dashboard" : null);
  const activeGroup = groups.find((g) => g.group.href === activeHref);
  // No ?tab= (or an unknown one) means the page's default, i.e. its first section.
  const requested = params.get("tab");
  const activeTab = activeGroup && activeGroup.children.some((c) => c.value === requested) ? requested : activeGroup?.children[0]?.value ?? null;
  return { groups, pathname, activeHref, activeTab };
}

export function DashboardSidebar({ role }: { role: Role | undefined }) {
  const { groups, activeHref, activeTab } = useNav(role);
  // Groups the person opened or closed by hand; the group you are in is always open.
  const [manual, setManual] = React.useState<Record<string, boolean>>({});
  const isOpen = (href: string) => (href in manual ? manual[href] : href === activeHref);

  return (
    <nav aria-label="Dashboard" className="mt-6 flex flex-col gap-1">
      {groups.map(({ group, children }) => {
        const Icon = ICONS[group.icon];
        const here = group.href === activeHref;
        const open = children.length > 0 && isOpen(group.href);
        return (
          <div key={group.href}>
            <div className={`flex items-center rounded-md ${here ? "bg-brand-50" : "hover:bg-slate-100"}`}>
              <Link
                href={group.href}
                aria-current={here && children.length === 0 ? "page" : undefined}
                onClick={() => children.length > 0 && setManual((m) => ({ ...m, [group.href]: true }))}
                className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-sm font-medium ${here ? "text-brand-700" : "text-slate-600"}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{group.label}</span>
              </Link>
              {children.length > 0 && (
                <button
                  type="button"
                  aria-label={`${open ? "Collapse" : "Expand"} ${group.label}`}
                  aria-expanded={open}
                  onClick={() => setManual((m) => ({ ...m, [group.href]: !open }))}
                  className="mr-1 rounded p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>
            {open && (
              <ul className="ml-4 mt-1 flex flex-col gap-0.5 border-l border-slate-200 pl-2">
                {children.map((c) => {
                  const active = here && activeTab === c.value;
                  return (
                    <li key={c.value}>
                      <Link
                        href={`${group.href}?tab=${c.value}`}
                        aria-current={active ? "page" : undefined}
                        className={`block truncate rounded-md px-2 py-1.5 text-sm ${
                          active ? "bg-brand-50 font-medium text-brand-700" : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {c.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

/** Phones: a strip of the groups, and under it the sections of the group you are in. */
export function MobileNav({ role }: { role: Role | undefined }) {
  const { groups, activeHref, activeTab } = useNav(role);
  const current = groups.find((g) => g.group.href === activeHref);
  const pill = (active: boolean) =>
    `flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${
      active ? "bg-brand-50 text-brand-700" : "text-slate-600"
    }`;
  return (
    <div className="border-b border-slate-200 bg-white sm:hidden">
      <nav aria-label="Dashboard" className="flex gap-1 overflow-x-auto px-3 py-2">
        {groups.map(({ group }) => {
          const Icon = ICONS[group.icon];
          return (
            <Link key={group.href} href={group.href} className={pill(group.href === activeHref)}>
              <Icon className="h-4 w-4" />
              {group.label}
            </Link>
          );
        })}
      </nav>
      {current && current.children.length > 0 && (
        <nav aria-label={`${current.group.label} sections`} className="flex gap-1 overflow-x-auto border-t border-slate-100 px-3 py-2">
          {current.children.map((c) => (
            <Link
              key={c.value}
              href={`${current.group.href}?tab=${c.value}`}
              aria-current={activeTab === c.value ? "page" : undefined}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium ${
                activeTab === c.value ? "border-brand-200 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600"
              }`}
            >
              {c.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
