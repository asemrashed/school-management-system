import * as React from "react";
import { Card, CardContent } from "../components/card";
import { cn } from "../lib/cn";

export function StatCard({
  label,
  value,
  hint,
  icon,
  trend,
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
  trend?: { direction: "up" | "down"; value: string };
  className?: string;
}) {
  return (
    <Card className={cn("p-0", className)}>
      <CardContent className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
          {trend && (
            <p
              className={cn(
                "mt-1 text-xs font-medium",
                trend.direction === "up" ? "text-emerald-600" : "text-red-600"
              )}
            >
              {trend.direction === "up" ? "▲" : "▼"} {trend.value}
            </p>
          )}
        </div>
        {icon && <div className="rounded-md bg-brand-50 p-2 text-brand-600">{icon}</div>}
      </CardContent>
    </Card>
  );
}
