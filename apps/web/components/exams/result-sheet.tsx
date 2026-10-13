"use client";

import * as React from "react";
import { Download } from "lucide-react";
import {
  Badge, Button, EmptyState, ErrorState, Input, LoadingSkeleton, OffsetPagination, Select, useToast,
} from "@packages/ui";
import { EXAM_TERM_LABELS, type ExamStatus } from "@packages/shared-types";
import { API_BASE_URL } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import { useDebounced, useLookup } from "@/lib/hooks/use-setup";
import { sheetQuery, useExamSessions, useResultSheet, type SheetParams } from "@/lib/hooks/use-exam-sessions";

const STATUS_STYLE: Record<ExamStatus, string> = {
  draft: "text-slate-400",
  submitted: "text-amber-600",
  approved: "text-emerald-600",
  published: "text-emerald-700",
};

/**
 * Spreadsheet-style result sheet: a row per student, a column per subject.
 * Filtering / sorting / paging are server-side, so it stays fast for big classes.
 * A teacher is served only their own subject column(s) by the API.
 */
export function ResultSheet({ initialSessionId }: { initialSessionId?: string }) {
  const { toast } = useToast();
  const sessions = useExamSessions();
  const [sessionId, setSessionId] = React.useState(initialSessionId ?? "");
  const [sectionId, setSectionId] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [result, setResult] = React.useState<"all" | "pass" | "fail">("all");
  const [sort, setSort] = React.useState<NonNullable<SheetParams["sort"]>>("roll");
  const [dir, setDir] = React.useState<"asc" | "desc">("asc");
  const [pageSize, setPageSize] = React.useState(25);
  const [page, setPage] = React.useState(1);
  const q = useDebounced(search, 300);

  const items = sessions.data?.items ?? [];
  React.useEffect(() => {
    if (!sessionId && items.length > 0) setSessionId(items[0].id);
  }, [items, sessionId]);
  const current = items.find((s) => s.id === sessionId);

  // Any filter change goes back to page 1.
  React.useEffect(() => setPage(1), [sessionId, sectionId, q, result, sort, dir, pageSize]);

  const params: SheetParams = { sectionId, q, result, sort, dir, page, pageSize };
  const sheet = useResultSheet(sessionId || null, params);
  const sections = useLookup("sections", "", { classId: current?.classId }, Boolean(current));
  const data = sheet.data?.sheet;

  async function downloadCsv() {
    try {
      const res = await fetch(
        `${API_BASE_URL}/exam-sessions/${sessionId}/results${sheetQuery({ sectionId, q, result, sort, dir })}${
          sheetQuery({ sectionId, q, result, sort, dir }) ? "&" : "?"
        }format=csv`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("download failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${current?.name ?? "results"}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      toast({ title: "Could not download", description: errorMessage(err), variant: "error" });
    }
  }

  if (sessions.isLoading) return <LoadingSkeleton rows={4} />;
  if (sessions.isError) return <ErrorState onRetry={() => sessions.refetch()} />;
  if (items.length === 0) return <EmptyState title="No exams yet" description="Results appear here once an exam is created." />;

  const sortHeader = (key: NonNullable<SheetParams["sort"]>, label: string) => (
    <button
      type="button"
      className="inline-flex items-center gap-1 font-semibold hover:text-brand-700"
      onClick={() => {
        if (sort === key) setDir(dir === "asc" ? "desc" : "asc");
        else { setSort(key); setDir(key === "total" || key === "percent" ? "desc" : "asc"); }
      }}
    >
      {label}{sort === key ? (dir === "asc" ? " ▲" : " ▼") : ""}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[12rem] flex-col gap-1 text-xs text-slate-500">
          Exam
          <Select value={sessionId} onChange={(e) => { setSessionId(e.target.value); setSectionId(""); }}>
            {items.map((s) => (
              <option key={s.id} value={s.id}>{s.name} · {s.className} · {EXAM_TERM_LABELS[s.term]}</option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Section
          <Select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            <option value="">All sections</option>
            {(sections.data?.items ?? []).map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </label>
        {data?.complete && (
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Result
            <Select value={result} onChange={(e) => setResult(e.target.value as typeof result)}>
              <option value="all">Pass &amp; fail</option>
              <option value="pass">Passed</option>
              <option value="fail">Failed</option>
            </Select>
          </label>
        )}
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-slate-500">
          Search
          <Input placeholder="Student name or roll" value={search} maxLength={80} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <Button variant="outline" size="sm" onClick={downloadCsv} disabled={!data || data.totalRows === 0}>
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>

      {sheet.isError ? (
        <ErrorState onRetry={() => sheet.refetch()} />
      ) : !data ? (
        <LoadingSkeleton rows={6} />
      ) : data.rows.length === 0 ? (
        <EmptyState title="No students match" description="Try clearing the filters." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <Badge variant={data.session.publishedAt ? "success" : "muted"}>{data.session.publishedAt ? "Published" : "Not published"}</Badge>
            <span>{data.totalRows} student{data.totalRows === 1 ? "" : "s"}</span>
            {!data.complete && <span className="text-xs text-slate-400">Showing only the subject(s) you teach.</span>}
          </div>
          <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-600">
                <tr>
                  <th className="px-3 py-2">Sec</th>
                  <th className="px-3 py-2">{sortHeader("roll", "Roll")}</th>
                  <th className="px-3 py-2">{sortHeader("name", "Student")}</th>
                  {data.subjects.map((s) => (
                    <th key={s.subjectId} className="whitespace-nowrap px-3 py-2 text-right">{s.name}<span className="block font-normal text-slate-400">/{s.maxMarks}</span></th>
                  ))}
                  <th className="px-3 py-2 text-right">{sortHeader("total", "Total")}</th>
                  <th className="px-3 py-2 text-right">{sortHeader("percent", "%")}</th>
                  {data.complete && <th className="px-3 py-2 text-center">Grade</th>}
                  {data.complete && <th className="px-3 py-2 text-right">GPA</th>}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.studentId} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2">{r.sectionName}</td>
                    <td className="px-3 py-2">{r.rollNumber ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-800">{r.name}</td>
                    {data.subjects.map((s) => {
                      const c = r.cells[s.subjectId];
                      return (
                        <td key={s.subjectId} className={`px-3 py-2 text-right tabular-nums ${c?.status ? STATUS_STYLE[c.status] : "text-slate-300"}`}
                            title={c?.status ?? "no exam"}>
                          {c?.obtained ?? "—"}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right tabular-nums">{r.maxTotal ? `${r.total}/${r.maxTotal}` : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.percent ?? "—"}</td>
                    {data.complete && (
                      <td className="px-3 py-2 text-center">
                        {r.grade ? <Badge variant={r.passed ? "success" : "danger"}>{r.grade}</Badge> : "—"}
                      </td>
                    )}
                    {data.complete && <td className="px-3 py-2 text-right tabular-nums">{r.gpa ?? "—"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400">
            Colour = approval state: <span className="text-slate-400">grey draft</span> · <span className="text-amber-600">amber awaiting approval</span> · <span className="text-emerald-600">green approved</span>.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-500">
              Rows per page
              <Select className="w-20" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </label>
            <div className="min-w-[14rem] flex-1 sm:max-w-sm">
              <OffsetPagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
