"use client";

import * as React from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, useToast } from "@packages/ui";
import type { Role, RoleAccountLimitRow } from "@packages/shared-types";
import { errorMessage } from "@/lib/errors";
import { useRoleAccountLimits, useSetRoleAccountLimit } from "@/lib/hooks/use-setup";

/** Super Admin: cap how many active accounts each role may have. */
export function RoleLimitsPanel() {
  const { toast } = useToast();
  const limits = useRoleAccountLimits();
  const save = useSetRoleAccountLimit();

  async function apply(role: Role, maxAccounts: number | null) {
    try {
      await save.mutateAsync({ role, maxAccounts });
      toast({ title: maxAccounts === null ? "Limit removed" : "Limit saved", variant: "success" });
    } catch (err) {
      toast({ title: "Could not save limit", description: errorMessage(err), variant: "error" });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account limits per role</CardTitle>
        <p className="text-sm text-slate-500">
          The most <em>active</em> accounts each role may have. Disabled accounts don't count. Lowering a limit never
          removes anyone — it only blocks new accounts until the number drops. Leave blank for no limit.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col divide-y divide-slate-100">
          {limits.data?.items.map((row) => <LimitRow key={row.role} row={row} busy={save.isPending} onApply={apply} />)}
          {limits.isLoading && <p className="py-3 text-sm text-slate-500">Loading…</p>}
          {limits.isError && <p className="py-3 text-sm text-red-600">Could not load limits.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function LimitRow({ row, busy, onApply }: { row: RoleAccountLimitRow; busy: boolean; onApply: (role: Role, max: number | null) => void }) {
  const [value, setValue] = React.useState(row.maxAccounts?.toString() ?? "");
  React.useEffect(() => setValue(row.maxAccounts?.toString() ?? ""), [row.maxAccounts]);
  const parsed = value.trim() === "" ? null : Number(value);
  const valid = parsed === null || (Number.isInteger(parsed) && parsed >= 1);
  const dirty = parsed !== row.maxAccounts;
  const over = row.maxAccounts !== null && row.activeAccounts > row.maxAccounts;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-3">
        <span className="w-28 text-sm font-medium capitalize text-slate-700">{row.role.replace("_", " ")}</span>
        <Badge variant={over ? "danger" : row.maxAccounts !== null && row.activeAccounts === row.maxAccounts ? "warning" : "muted"}>
          {row.activeAccounts} active{row.maxAccounts !== null ? ` / ${row.maxAccounts}` : ""}
        </Badge>
        {over && <span className="text-xs text-red-600">Over the limit — no new accounts until it drops.</span>}
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number" min={1} className="w-28" placeholder="No limit" aria-label={`${row.role} account limit`}
          value={value} onChange={(e) => setValue(e.target.value)}
        />
        <Button size="sm" disabled={busy || !dirty || !valid} onClick={() => onApply(row.role, parsed)}>Save</Button>
      </div>
    </div>
  );
}
