"use client";

import * as React from "react";
import { Check, X, Clock, FileQuestion } from "lucide-react";
import { Button, LoadingSkeleton, EmptyState, useToast } from "@packages/ui";
import type { AttendanceStatus } from "@packages/shared-types";
import { useSectionRoster } from "@/lib/hooks/use-academics";
import { useAttendance, useSubmitAttendance } from "@/lib/hooks/use-attendance";
import { ApiError } from "@/lib/api-client";

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "present", label: "Present", icon: Check },
  { value: "absent", label: "Absent", icon: X },
  { value: "late", label: "Late", icon: Clock },
  { value: "excused", label: "Excused", icon: FileQuestion },
];

/**
 * Shared attendance-taking widget (component-registry.md: AttendanceWidget,
 * used by Teacher + Admin dashboards). Loads the section roster, lets the
 * taker set a status per student, and submits the whole section at once.
 */
export function AttendanceWidget({ sectionId, date }: { sectionId: string; date: string }) {
  const { toast } = useToast();
  const roster = useSectionRoster(sectionId);
  const existing = useAttendance(sectionId, date);
  const submit = useSubmitAttendance();

  const [statuses, setStatuses] = React.useState<Record<string, AttendanceStatus>>({});

  React.useEffect(() => {
    if (!existing.data) return;
    const next: Record<string, AttendanceStatus> = {};
    for (const record of existing.data.items) next[record.studentId] = record.status;
    setStatuses(next);
  }, [existing.data]);

  if (roster.isLoading) return <LoadingSkeleton rows={5} />;
  if (roster.isError || !roster.data) {
    return <EmptyState title="Could not load the roster" description="Try selecting the section again." />;
  }
  if (roster.data.items.length === 0) {
    return <EmptyState title="No students in this section yet" />;
  }

  async function handleSubmit() {
    const entries = roster.data!.items.map((s) => ({
      studentId: s.id,
      status: statuses[s.id] ?? "present",
    }));
    try {
      await submit.mutateAsync({ sectionId, date, entries });
      toast({ title: "Attendance saved", variant: "success" });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not save attendance.";
      toast({ title: "Could not save", description: message, variant: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
        {roster.data.items.map((student) => {
          const current = statuses[student.id] ?? "present";
          return (
            <div key={student.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div>
                <p className="text-sm font-medium text-slate-800">{student.name}</p>
                {student.rollNumber && <p className="text-xs text-slate-400">Roll {student.rollNumber}</p>}
              </div>
              <div className="flex flex-wrap gap-1.5 sm:gap-1">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={current === opt.value}
                    onClick={() => setStatuses((prev) => ({ ...prev, [student.id]: opt.value }))}
                    className={`flex min-h-9 items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:min-h-0 sm:px-2 sm:py-1 ${
                      current === opt.value
                        ? "bg-brand-600 text-white"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    <opt.icon className="h-3 w-3" />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <Button onClick={handleSubmit} disabled={submit.isPending} className="self-end">
        {submit.isPending ? "Saving..." : "Save attendance"}
      </Button>
    </div>
  );
}
