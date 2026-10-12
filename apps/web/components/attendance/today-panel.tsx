"use client";

import { CalendarCheck, ClipboardList } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, ErrorState, Skeleton } from "@packages/ui";
import { WEEKDAYS } from "@packages/shared-types";
import { useRoutine } from "@/lib/hooks/use-setup";
import { useAttendanceSections } from "@/lib/hooks/use-academics";

/** The browser's local calendar date (YYYY-MM-DD), not UTC, so "today" is right in Dhaka. */
export const localIsoDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Teacher landing tab: attendance still to do, plus today's classes in time order. */
export function TodayPanel({ onTakeAttendance }: { onTakeAttendance: (sectionId: string) => void }) {
  const today = WEEKDAYS[new Date().getDay()];
  const routine = useRoutine({ mine: true });
  const duty = useAttendanceSections(localIsoDate());

  const periods = new Map((routine.data?.periods ?? []).map((p) => [p.id, p]));
  const todays = (routine.data?.entries ?? [])
    .filter((e) => e.dayOfWeek === today)
    .map((e) => ({ e, p: periods.get(e.periodId) }))
    .sort((a, b) => (a.p?.startTime ?? "").localeCompare(b.p?.startTime ?? ""));
  const pending = (duty.data?.items ?? []).filter((s) => !s.takenToday).length;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2"><CalendarCheck className="h-4 w-4" aria-hidden /> Attendance to do today</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {duty.isLoading && <Skeleton className="h-20 w-full" />}
          {duty.isError && <ErrorState onRetry={() => duty.refetch()} />}
          {duty.data && duty.data.items.length === 0 && (
            <EmptyState title="You are not an attendance taker" description="No section has you as its first teacher. Ask an admin to flag you for your section." />
          )}
          {duty.data && duty.data.items.length > 0 && pending === 0 && <p className="text-sm text-emerald-700">All attendance for today is done.</p>}
          {duty.data?.items.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
              <div>
                <p className="text-sm font-medium text-slate-800">{s.label}</p>
                <p className="text-xs text-slate-500">{s.studentCount} student{s.studentCount === 1 ? "" : "s"}</p>
              </div>
              {s.takenToday ? (
                <div className="flex items-center gap-2">
                  <Badge variant="success">Taken</Badge>
                  <span className="text-xs text-slate-600">{s.presentCount} present / {s.absentCount} absent</span>
                  <Button size="sm" variant="ghost" onClick={() => onTakeAttendance(s.id)}>Edit</Button>
                </div>
              ) : (
                <Button size="sm" onClick={() => onTakeAttendance(s.id)}>Take attendance</Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2"><ClipboardList className="h-4 w-4" aria-hidden /> Today&apos;s classes</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2">
          {routine.isLoading && <Skeleton className="h-20 w-full" />}
          {routine.isError && <ErrorState onRetry={() => routine.refetch()} />}
          {routine.data && todays.length === 0 && <EmptyState title="No classes today" description="Nothing is scheduled for you today." />}
          {todays.map(({ e, p }) => (
            <div key={e.id} className="flex items-center justify-between gap-3 rounded-md bg-brand-50 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-brand-800">{e.subjectName}</p>
                <p className="text-xs text-slate-600">{e.className} {e.sectionName}{e.roomName ? ` · Room ${e.roomName}` : ""}</p>
              </div>
              <span className="whitespace-nowrap text-xs font-medium text-slate-700">{p ? `${p.startTime} – ${p.endTime}` : ""}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
