"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, Checkbox, ConfirmDialog, DataTable, FormModal, Input,
  Label, PageHeader, Select, Textarea, useToast,
} from "@packages/ui";
import {
  EXAM_TERM_LABELS, createExamSessionSchema, type ExamSessionExamRow, type ExamStatus, type ExamTerm,
} from "@packages/shared-types";
import { LookupCombobox } from "@/components/forms/lookup-combobox";
import { errorMessage } from "@/lib/errors";
import { useSubjects } from "@/lib/hooks/use-academics";
import { useMarks } from "@/lib/hooks/use-exams";
import { useLookup } from "@/lib/hooks/use-setup";
import {
  useApproveExam, useCreateExamSession, useDeleteExamSession, useExamSessions, useRejectExam, useSessionProgress,
} from "@/lib/hooks/use-exam-sessions";

const STATUS_BADGE: Record<ExamStatus, { label: string; variant: "muted" | "warning" | "default" | "success" }> = {
  draft: { label: "Teacher entering marks", variant: "muted" },
  submitted: { label: "Awaiting approval", variant: "warning" },
  approved: { label: "Approved", variant: "default" },
  published: { label: "Published", variant: "success" },
};

/**
 * Admin / coordinator: schedule an exam for a whole class, follow teachers'
 * mark entry, then approve or send back each subject. When the last subject
 * is approved the result publishes automatically.
 */
export function ExamManagement() {
  const sessions = useExamSessions();
  const [selected, setSelected] = React.useState<string | null>(null);
  const del = useDeleteExamSession();
  const { toast } = useToast();
  const [toDelete, setToDelete] = React.useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Exams"
        description="Create an exam for a class. Teachers enter marks per subject; you approve them, and results publish once every subject is approved."
        actions={<NewExamModal onCreated={setSelected} />}
      />
      <DataTable
        columns={[
          { key: "name", header: "Exam", render: (s) => <span className="font-medium">{s.name}</span> },
          { key: "class", header: "Class", render: (s) => s.className },
          { key: "term", header: "Term", render: (s) => EXAM_TERM_LABELS[s.term] },
          { key: "progress", header: "Approved", render: (s) => `${s.progress.approved}/${s.progress.total} (${s.progress.submitted} submitted)` },
          { key: "status", header: "Status", render: (s) => <Badge variant={s.publishedAt ? "success" : "muted"}>{s.publishedAt ? "Published" : "In progress"}</Badge> },
          {
            key: "actions", header: "", render: (s) => (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setSelected(s.id)}>Review</Button>
                {!s.publishedAt && <Button size="sm" variant="ghost" onClick={() => setToDelete(s.id)}>Delete</Button>}
              </div>
            ),
          },
        ]}
        data={sessions.data?.items ?? []}
        keyField={(s) => s.id}
        isLoading={sessions.isLoading}
        isError={sessions.isError}
        onRetry={() => sessions.refetch()}
        emptyTitle="No exams yet"
        emptyDescription="Use “New exam” to schedule a mid-term or final."
      />
      {selected && <SessionReview sessionId={selected} onClose={() => setSelected(null)} />}
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete this exam?"
        description="All its marks are removed. This cannot be undone."
        confirmLabel="Delete"
        loading={del.isPending}
        onConfirm={async () => {
          try {
            await del.mutateAsync(toDelete!);
            if (selected === toDelete) setSelected(null);
            setToDelete(null);
            toast({ title: "Exam deleted", variant: "success" });
          } catch (err) {
            toast({ title: "Could not delete", description: errorMessage(err), variant: "error" });
          }
        }}
      />
    </div>
  );
}

function NewExamModal({ onCreated }: { onCreated: (id: string) => void }) {
  const { toast } = useToast();
  const create = useCreateExamSession();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [term, setTerm] = React.useState<ExamTerm>("mid_term");
  const [examDate, setExamDate] = React.useState("");
  const [classId, setClassId] = React.useState("");
  const [picked, setPicked] = React.useState<Record<string, string>>({}); // subjectId -> maxMarks
  const [sectionIds, setSectionIds] = React.useState<string[]>([]);
  const subjects = useSubjects(classId || undefined);
  const sections = useLookup("sections", "", { classId }, Boolean(classId));

  React.useEffect(() => { setPicked({}); setSectionIds([]); }, [classId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = createExamSessionSchema.safeParse({
      name, term, type: "offline", classId, examDate,
      subjects: Object.entries(picked).map(([subjectId, m]) => ({ subjectId, maxMarks: Number(m) })),
      sectionIds: sectionIds.length ? sectionIds : undefined,
    });
    if (!parsed.success) {
      toast({ title: "Check the form", description: parsed.error.issues[0]?.message, variant: "error" });
      return;
    }
    try {
      const r = await create.mutateAsync(parsed.data);
      toast({ title: "Exam created", description: "Teachers can now enter marks.", variant: "success" });
      setOpen(false); setName(""); setExamDate(""); setClassId("");
      onCreated(r.session.id);
    } catch (err) {
      toast({ title: "Could not create", description: errorMessage(err), variant: "error" });
    }
  }

  return (
    <FormModal open={open} onOpenChange={setOpen} title="New exam" trigger={<Button size="sm"><Plus className="h-4 w-4" /> New exam</Button>}>
      <form onSubmit={submit} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="es-name">Name</Label>
          <Input id="es-name" value={name} maxLength={160} placeholder="Mid-term 2026" onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="es-term">Term</Label>
            <Select id="es-term" value={term} onChange={(e) => setTerm(e.target.value as ExamTerm)}>
              {(Object.keys(EXAM_TERM_LABELS) as ExamTerm[]).map((t) => <option key={t} value={t}>{EXAM_TERM_LABELS[t]}</option>)}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="es-date">Start date</Label>
            <Input id="es-date" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Class</Label>
          <LookupCombobox kind="classes" value={classId} onChange={(v) => setClassId(v)} placeholder="Select class…" />
        </div>
        {classId && (
          <>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">Subjects and full marks</legend>
              {(subjects.data?.items ?? []).length === 0 && <p className="text-sm text-slate-500">This class has no subjects yet.</p>}
              {(subjects.data?.items ?? []).map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={s.id in picked}
                      onChange={(e) => setPicked((p) => {
                        const next = { ...p };
                        if (e.target.checked) next[s.id] = "100"; else delete next[s.id];
                        return next;
                      })}
                    />
                    {s.name}
                  </label>
                  {s.id in picked && (
                    <Input className="w-24" type="number" min={1} max={1000} aria-label={`${s.name} full marks`} value={picked[s.id]} onChange={(e) => setPicked({ ...picked, [s.id]: e.target.value })} />
                  )}
                </div>
              ))}
            </fieldset>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">Sections <span className="font-normal text-slate-400">(none ticked = all)</span></legend>
              <div className="flex flex-wrap gap-3">
                {(sections.data?.items ?? []).map((s) => (
                  <label key={s.value} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={sectionIds.includes(s.value)} onChange={(e) => setSectionIds((ids) => e.target.checked ? [...ids, s.value] : ids.filter((i) => i !== s.value))} />
                    {s.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}
        <Button type="submit" disabled={create.isPending}>{create.isPending ? "Creating..." : "Create exam"}</Button>
      </form>
    </FormModal>
  );
}

function SessionReview({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const { toast } = useToast();
  const progress = useSessionProgress(sessionId);
  const approve = useApproveExam();
  const reject = useRejectExam();
  const [viewing, setViewing] = React.useState<ExamSessionExamRow | null>(null);
  const [returning, setReturning] = React.useState<ExamSessionExamRow | null>(null);
  const [note, setNote] = React.useState("");

  async function doApprove(row: ExamSessionExamRow) {
    try {
      const r = await approve.mutateAsync(row.examId);
      toast({
        title: r.sessionPublished ? "Approved — results published" : "Approved",
        description: r.sessionPublished ? "Guardians were notified and students can now see their results." : undefined,
        variant: "success",
      });
    } catch (err) {
      toast({ title: "Could not approve", description: errorMessage(err), variant: "error" });
    }
  }

  async function doReturn() {
    if (!returning) return;
    try {
      await reject.mutateAsync({ examId: returning.examId, note });
      toast({ title: "Sent back to the teacher", variant: "success" });
      setReturning(null); setNote("");
    } catch (err) {
      toast({ title: "Could not return", description: errorMessage(err), variant: "error" });
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle>Mark entry &amp; approval</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={[
            { key: "sec", header: "Section", render: (r) => r.sectionName },
            { key: "sub", header: "Subject", render: (r) => <span className="font-medium">{r.subjectName}</span> },
            { key: "teacher", header: "Teacher", render: (r) => r.teacherName ?? <span className="text-red-600">Not assigned</span> },
            { key: "marks", header: "Marks in", render: (r) => `${r.marksEntered}/${r.studentCount}` },
            {
              key: "status", header: "Status", render: (r) => (
                <div>
                  <Badge variant={STATUS_BADGE[r.status].variant}>{STATUS_BADGE[r.status].label}</Badge>
                  {r.status === "draft" && r.returnNote && <p className="mt-1 max-w-xs text-xs text-amber-700">Returned: {r.returnNote}</p>}
                </div>
              ),
            },
            {
              key: "actions", header: "", render: (r) => (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setViewing(r)}>View marks</Button>
                  {r.status === "submitted" && (
                    <>
                      <Button size="sm" onClick={() => doApprove(r)} disabled={approve.isPending}>Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => setReturning(r)}>Return</Button>
                    </>
                  )}
                </div>
              ),
            },
          ]}
          data={progress.data?.items ?? []}
          keyField={(r) => r.examId}
          isLoading={progress.isLoading}
          isError={progress.isError}
          onRetry={() => progress.refetch()}
        />
      </CardContent>
      {viewing && <MarksViewer row={viewing} onClose={() => setViewing(null)} />}
      <FormModal open={Boolean(returning)} onOpenChange={(o) => !o && setReturning(null)} title="Return marks to the teacher" description="They can edit and submit again.">
        <div className="flex flex-col gap-3">
          <Label htmlFor="rj-note">What should they fix?</Label>
          <Textarea id="rj-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
          <Button onClick={doReturn} disabled={reject.isPending || note.trim().length < 3}>{reject.isPending ? "Sending..." : "Return marks"}</Button>
        </div>
      </FormModal>
    </Card>
  );
}

function MarksViewer({ row, onClose }: { row: ExamSessionExamRow; onClose: () => void }) {
  const marks = useMarks(row.examId);
  return (
    <FormModal open onOpenChange={(o) => !o && onClose()} title={`${row.subjectName} — Section ${row.sectionName}`} description={`Full marks ${row.maxMarks}`}>
      <div className="max-h-[60vh] overflow-y-auto">
        {marks.isLoading ? <p className="text-sm text-slate-500">Loading…</p> : (marks.data?.items ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No marks entered yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500"><tr><th className="py-1">Roll</th><th>Student</th><th className="text-right">Marks</th></tr></thead>
            <tbody>
              {marks.data!.items.map((m) => (
                <tr key={m.id} className="border-t border-slate-100"><td className="py-1">{m.rollNumber ?? "—"}</td><td>{m.studentName}</td><td className="text-right tabular-nums">{m.marksObtained}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </FormModal>
  );
}
