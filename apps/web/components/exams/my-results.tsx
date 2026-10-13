"use client";

import * as React from "react";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, ErrorState, LoadingSkeleton } from "@packages/ui";
import { EXAM_TERM_LABELS } from "@packages/shared-types";
import { useMyResults } from "@/lib/hooks/use-exam-sessions";

/** Published report cards. The API only returns this viewer's own child/children. */
export function MyResults() {
  const results = useMyResults();
  if (results.isLoading) return <LoadingSkeleton rows={3} />;
  if (results.isError) return <ErrorState onRetry={() => results.refetch()} />;
  const kids = (results.data?.items ?? []).filter((k) => k.sessions.length > 0);
  if (kids.length === 0) return <EmptyState title="No published results yet" description="Results appear here once the school publishes them." />;
  const showName = (results.data?.items.length ?? 0) > 1;

  return (
    <div className="flex flex-col gap-4">
      {kids.flatMap((kid) =>
        kid.sessions.map((s) => (
          <Card key={`${kid.studentId}-${s.sessionId}`}>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 pb-3">
              <CardTitle>
                {s.sessionName} <span className="text-sm font-normal text-slate-500">· {EXAM_TERM_LABELS[s.term]}{showName ? ` · ${kid.studentName}` : ""}</span>
              </CardTitle>
              <Badge variant={s.passed ? "success" : "danger"}>{s.passed ? "Passed" : "Failed"} · {s.grade}</Badge>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-500"><tr><th className="py-1">Subject</th><th className="text-right">Marks</th><th className="text-right">Grade</th></tr></thead>
                  <tbody>
                    {s.subjects.map((x) => (
                      <tr key={x.subjectName} className="border-t border-slate-100">
                        <td className="py-1.5">{x.subjectName}</td>
                        <td className="text-right tabular-nums">{x.obtained}/{x.maxMarks}</td>
                        <td className="text-right">{x.grade}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 font-semibold">
                      <td className="py-1.5">Total</td>
                      <td className="text-right tabular-nums">{s.total}/{s.maxTotal} ({s.percent}%)</td>
                      <td className="text-right">GPA {s.gpa.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
