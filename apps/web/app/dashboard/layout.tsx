"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Wallet,
  BookOpen,
  MessageSquareText,
  GraduationCap,
  LogOut,
} from "lucide-react";
import { UserAvatar, Button, RoleGate } from "@packages/ui";
import type { Role } from "@packages/shared-types";
import { useSession, useLogout } from "@/lib/hooks/use-auth";
import { ROLE_HOME, canAccessPath } from "@/lib/role-routes";
import { DashboardSidebar, MobileNav } from "@/components/dashboard/sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data, isLoading: sessionLoading } = useSession();
  const logout = useLogout();
  const user = data?.user ?? null;

  // Route guard: bounce a signed-in user away from dashboards their role
  // cannot use (e.g. a parent typing /dashboard/accountant) to their own home.
  React.useEffect(() => {
    if (user && !canAccessPath(user.role as Role, pathname)) {
      router.replace(ROLE_HOME[user.role as Role] ?? "/dashboard");
    }
  }, [user, pathname, router]);
  // Render nothing until we know who this is, so a page the role may not use
  // never mounts (and never fires its API calls) before the guard redirects.
  React.useEffect(() => {
    if (!sessionLoading && !user) router.replace("/login");
  }, [sessionLoading, user, router]);
  const blocked = !user || !canAccessPath(user.role as Role, pathname);

  async function handleLogout() {
    await logout.mutateAsync();
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 sm:flex">
        <p className="px-2 text-sm font-semibold text-brand-700">School Portal</p>
        <React.Suspense fallback={null}>
          <DashboardSidebar role={user?.role as Role | undefined} />
        </React.Suspense>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <p className="text-sm text-slate-500">
            {user ? `Signed in as ${user.role.replace("_", " ")}` : "Loading..."}
          </p>
          <div className="flex items-center gap-3">
            {user && <UserAvatar name={user.name} size="sm" />}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </header>
        <React.Suspense fallback={null}>
          <MobileNav role={user?.role as Role | undefined} />
        </React.Suspense>
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          {/* useSearchParams (URL tabs) needs a Suspense boundary for static builds. */}
          <React.Suspense fallback={null}>{blocked ? null : children}</React.Suspense>
        </main>
      </div>
    </div>
  );
}
