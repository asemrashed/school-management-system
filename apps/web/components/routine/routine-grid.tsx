"use client";

import * as React from "react";
import { Printer } from "lucide-react";
import { Button, EmptyState, LoadingSkeleton } from "@packages/ui";
import { WEEKDAYS, WEEKDAY_LABELS, type PeriodDto, type RoutineEntryDto, type Weekday } from "@packages/shared-types";

/** Core school week; Friday/Saturday columns appear only if something is scheduled. */
const CORE_DAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu"];

/**
 * Weekly class routine: one table per shift, periods down the side, days
 * across the top. `show` picks the second line of each cell — students see
 * who teaches, teachers see which class they are in.
 */
export function RoutineGrid({
  periods,
  entries,
  show,
  isLoading,
  emptyHint,
}: {
  periods: PeriodDto[];
  entries: RoutineEntryDto[];
  show: "teacher" | "class";
  isLoading?: boolean;
  emptyHint?: string;
}) {
  if (isLoading) return <LoadingSkeleton rows={5} />;
  if (periods.length === 0) {
    return (
      <EmptyState
        title="No routine yet"
        description={emptyHint ?? "Once periods are set up and classes are scheduled, the routine appears here."}
      />
    );
  }

  const shiftIds = Array.from(new Set(periods.map((p) => p.shiftId)));
  const usedDays = new Set(entries.map((e) => e.dayOfWeek));
  const days = WEEKDAYS.filter((d) => CORE_DAYS.includes(d) || usedDays.has(d));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end print:hidden">
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>
      {shiftIds.map((shiftId) => {
        const shiftPeriods = periods.filter((p) => p.shiftId === shiftId).sort((a, b) => a.sortOrder - b.sortOrder);
        return (
          <div key={shiftId} className="overflow-x-auto rounded-md border border-slate-200 bg-white">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="w-36 border-b border-slate-200 px-3 py-2">Period</th>
                  {days.map((d) => (
                    <th key={d} className="border-b border-l border-slate-200 px-3 py-2">
                      {WEEKDAY_LABELS[d]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shiftPeriods.map((p) => (
                  <tr key={p.id} className={p.isBreak ? "bg-slate-50 text-slate-500" : undefined}>
                    <td className="border-b border-slate-100 px-3 py-2 align-top">
                      <div className="font-medium text-slate-800">{p.name}</div>
                      <div className="text-xs text-slate-500">
                        {p.startTime}–{p.endTime}
                      </div>
                    </td>
                    {days.map((d) => {
                      const cell = entries.filter((e) => e.periodId === p.id && e.dayOfWeek === d);
                      return (
                        <td key={d} className="border-b border-l border-slate-100 px-3 py-2 align-top">
                          {p.isBreak ? (
                            <span className="text-xs italic">Break</span>
                          ) : (
                            cell.map((e) => (
                              <div key={e.id} className="mb-1 last:mb-0 rounded bg-brand-50 px-2 py-1">
                                <div className="font-medium text-slate-900">{e.subjectName}</div>
                                <div className="text-xs text-slate-600">
                                  {show === "teacher" ? e.teacherName : `${e.className} — ${e.sectionName}`}
                                  {e.roomName ? ` · ${e.roomName}` : ""}
                                </div>
                              </div>
                            ))
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
