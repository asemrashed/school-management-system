"use client";

import * as React from "react";
import { Users, Wallet, BookOpen, GraduationCap } from "lucide-react";
import { PageHeader, StatCard, PageSkeleton, RoleGate } from "@packages/ui";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/hooks/use-auth";
import { ROLE_HOME } from "@/lib/role-routes";

export default function DashboardOverviewPage() {
  const { data, isLoading } = useSession();
  const user = data?.user ?? null;
  const router = useRouter();

  // Only admin-tier roles use the generic overview; everyone else lands on
  // the dashboard built for their role.
  const usesOverview = user?.role === "super_admin" || user?.role === "admin" || user?.role === "coordinator";
  React.useEffect(() => {
    if (user && !usesOverview) {
      // Keep ?payment=success|failed from the gateway return so the fees tab can announce it.
      const payment = new URLSearchParams(window.location.search).get("payment");
      router.replace(payment ? `${ROLE_HOME[user.role]}?payment=${encodeURIComponent(payment)}` : ROLE_HOME[user.role]);
    }
  }, [user, usesOverview, router]);

  if (isLoading || (user && !usesOverview)) return <PageSkeleton />;

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user?.name ?? "there"}`}
        description="Here's what's happening at your school today."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <RoleGate allow={["super_admin", "admin", "coordinator"]} currentRole={user?.role}>
          <StatCard label="Total students" value="—" hint="Wire up in Phase 2" icon={<GraduationCap className="h-5 w-5" />} />
        </RoleGate>
        <RoleGate allow={["super_admin", "admin", "accountant"]} currentRole={user?.role}>
          <StatCard label="Fees due this month" value="—" hint="Wire up in Phase 2" icon={<Wallet className="h-5 w-5" />} />
        </RoleGate>
        <RoleGate allow={["super_admin", "admin", "librarian"]} currentRole={user?.role}>
          <StatCard label="Books issued" value="—" hint="Wire up in Phase 4" icon={<BookOpen className="h-5 w-5" />} />
        </RoleGate>
        <RoleGate allow={["super_admin", "admin"]} currentRole={user?.role}>
          <StatCard label="Active staff" value="—" hint="Wire up in Phase 2" icon={<Users className="h-5 w-5" />} />
        </RoleGate>
      </div>

      <p className="mt-8 text-sm text-slate-400">
        This overview is a Phase 1 placeholder. Attendance, fees and results widgets
        arrive in Phases 2–4 (see MASTER_PLAN.md).
      </p>
    </div>
  );
}
