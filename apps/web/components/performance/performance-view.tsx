"use client";

import * as React from "react";
import { CalendarCheck, ClipboardList, GraduationCap, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, StatCard, DataTable, EmptyState, LoadingSkeleton } from "@packages/ui";
import type { PerformanceDto } from "@packages/shared-types";
import { usePerformance } from "@/lib/hooks/use-performance";
import { useInvoices } from "@/lib/hooks/use-fees";
import { formatTaka } from "@/lib/money";

const pct = (n: number | null | undefined) => (n == null ? "—" : `${n}%`);

/** Accessible horizontal bar: the value is always printed as text and exposed via role="meter". */
function Bar({ label, value, hint }: { label: string; value: number | null; hint?: string }) {
  const width = Math.max(0, Math.min(100, value ?? 0));
  const tone = value == null ? "bg-slate-300" : value >= 70 ? "bg-emerald-500" : value >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="tabular-nums text-slate-600">
          {pct(value)}
          {hint && <span className="ml-2 text-xs text-slate-400">{hint}</span>}
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value ?? 0}
        aria-valuetext={value == null ? "No data" : `${value} percent`}
        className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
      >
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

/** KPI tiles: attendance %, overall %, fees due, pending assignments. */
export function OverviewTiles({ studentId }: { studentId: string | undefined }) {
  const perf = usePerformance(studentId);
  const invoices = useInvoices(studentId);
  if (!studentId) return null;
  if (perf.isLoading || invoices.isLoading) return <LoadingSkeleton rows={2} />;
  if (perf.isError || !perf.data) return <EmptyState title="Could not load overview" description="Please refresh and try again." />;
  const p = perf.data.performance;
  const due = (invoices.data?.items ?? []).reduce((sum, i) => sum + (i.amountDue - i.amountPaid), 0);
  const pending = Math.max(p.assignments.total - p.assignments.submitted, 0);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Attendance" value={pct(p.attendance.percent)} hint={`${p.attendance.total} days recorded`} icon={<CalendarCheck className="h-5 w-5" />} />
      <StatCard label="Overall result" value={pct(p.overallPercent)} hint={`${p.exams.length} published results`} icon={<GraduationCap className="h-5 w-5" />} />
      <StatCard label="Fees due" value={formatTaka(due)} hint={due > 0 ? "Outstanding balance" : "All paid"} icon={<Wallet className="h-5 w-5" />} />
      <StatCard label="Pending assignments" value={pending} hint={`${p.assignments.submitted} of ${p.assignments.total} submitted`} icon={<ClipboardList className="h-5 w-5" />} />
    </div>
  );
}

export function PerformanceView({ studentId }: { studentId: string | undefined }) {
  const perf = usePerformance(studentId);
  if (!studentId) return <EmptyState title="No student selected" />;
  if (perf.isLoading) return <LoadingSkeleton rows={4} />;
  if (perf.isError || !perf.data) return <EmptyState title="Could not load performance" description="Please refresh and try again." />;
  const p: PerformanceDto = perf.data.performance;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader><CardTitle>Attendance</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {p.attendance.total === 0 ? (
            <p className="text-sm text-slate-500">No attendance recorded yet.</p>
          ) : (
            <>
              <Bar label="Attended (present + late)" value={p.attendance.percent} hint={`${p.attendance.total} days`} />
              <p className="text-sm text-slate-600">
                Present {p.attendance.present} · Late {p.attendance.late} · Absent {p.attendance.absent}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Subject-wise average</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          {p.subjects.length === 0 ? (
            <p className="text-sm text-slate-500">No published results yet.</p>
          ) : (
            p.subjects.map((s) => (
              <Bar key={s.subjectName} label={s.subjectName} value={s.averagePercent} hint={`${s.examsCount} exam${s.examsCount === 1 ? "" : "s"}`} />
            ))
          )}
          {p.overallPercent != null && <Bar label="Overall" value={p.overallPercent} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Exam results</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            columns={[
              { key: "exam", header: "Exam", render: (e) => e.examName },
              { key: "subject", header: "Subject", render: (e) => e.subjectName },
              { key: "date", header: "Date", render: (e) => e.examDate },
              { key: "marks", header: "Marks", render: (e) => `${e.marksObtained} / ${e.maxMarks}` },
              { key: "pct", header: "Percent", render: (e) => <span className="tabular-nums">{e.percent}%</span> },
            ]}
            data={p.exams}
            keyField={(e) => e.examId}
            emptyTitle="No published results yet"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Assignment progress</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {p.assignments.total === 0 ? (
            <p className="text-sm text-slate-500">No assignments set yet.</p>
          ) : (
            <>
              <Bar label="Submitted" value={Math.round((p.assignments.submitted / p.assignments.total) * 100)} hint={`${p.assignments.submitted} of ${p.assignments.total}`} />
              <Bar label="Graded" value={Math.round((p.assignments.graded / p.assignments.total) * 100)} hint={`${p.assignments.graded} of ${p.assignments.total}`} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
