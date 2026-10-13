"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import {
  PageHeader,
  Select,
  Input,
  Label,
  Textarea,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  FormModal,
  ConfirmDialog,
  DataTable,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  EmptyState,
  FileUploader,
  useToast,
} from "@packages/ui";
import {
  createResourceSchema,
  createAssignmentSchema,
  gradeSubmissionSchema,
  RESOURCE_KINDS,
  type ResourceKind,
  type ExamDto,
  type ExamStatus,
} from "@packages/shared-types";
import { useSession } from "@/lib/hooks/use-auth";
import { AttendanceWidget } from "@/components/attendance/attendance-widget";
import { apiUpload, ApiError } from "@/lib/api-client";
import { useClassAssignments, useSectionRoster, useAttendanceSections } from "@/lib/hooks/use-academics";
import { MyRoutine } from "@/components/routine/my-routine";
import { useResources, useCreateResource } from "@/lib/hooks/use-resources";
import { useAssignments, useCreateAssignment, useSubmissions, useGradeSubmission } from "@/lib/hooks/use-assignments";
import { useExams, useMarks, useSubmitMarks } from "@/lib/hooks/use-exams";
import { useSubmitExam } from "@/lib/hooks/use-exam-sessions";
import { ResultSheet } from "@/components/exams/result-sheet";
import { errorMessage } from "@/lib/errors";

import { TodayPanel, localIsoDate } from "@/components/attendance/today-panel";
import { useUrlTab } from "@/lib/use-url-tab";

const TAB_VALUES = ["today", "attendance", "routine", "resources", "assignments", "exams", "results"] as const;

// The teacher's local calendar date: toISOString() is UTC and is "yesterday" for Dhaka until 6 AM.
const todayIso = localIsoDate;

/** One dropdown of "my sections", shared by every tab below. */
function useMySections() {
  const assignments = useClassAssignments({ mine: true });
  const [sectionId, setSectionId] = React.useState("");
  const options = React.useMemo(() => {
    const map = new Map<string, { id: string; label: string; classId: string; subjects: { id: string; name: string }[] }>();
    for (const a of assignments.data?.items ?? []) {
      const existing = map.get(a.sectionId);
      const subj = { id: a.subjectId, name: a.subjectName };
      if (existing) {
        if (!existing.subjects.some((s) => s.id === subj.id)) existing.subjects.push(subj);
      } else {
        map.set(a.sectionId, { id: a.sectionId, label: `${a.className} — ${a.sectionName}`, classId: a.classId, subjects: [subj] });
      }
    }
    return Array.from(map.values());
  }, [assignments.data]);

  React.useEffect(() => {
    if (!sectionId && options.length > 0) setSectionId(options[0].id);
  }, [options, sectionId]);

  const current = options.find((o) => o.id === sectionId);
  return { options, sectionId, setSectionId, current, isLoading: assignments.isLoading };
}

export default function TeacherDashboardPage() {
  const session = useSession();
  const [tab, setTab] = useUrlTab("tab", "today", TAB_VALUES);
  const [requested, setRequested] = React.useState("");
  const firstName = session.data?.user?.name?.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return (
    <div>
      <PageHeader title={firstName ? `${greeting}, ${firstName}` : "Teaching"} description="Today's classes, attendance, materials, assignments and exams for your sections." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="routine">My Routine</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="exams">Exams</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>
        <TabsContent value="today">
          <TodayPanel onTakeAttendance={(id) => { setRequested(id); setTab("attendance"); }} />
        </TabsContent>
        <TabsContent value="attendance">
          <AttendancePanel requestedSectionId={requested} />
        </TabsContent>
        <TabsContent value="routine">
          <MyRoutine role="teacher" />
        </TabsContent>
        <TabsContent value="resources">
          <ResourcesPanel />
        </TabsContent>
        <TabsContent value="assignments">
          <AssignmentsPanel />
        </TabsContent>
        <TabsContent value="exams">
          <ExamsPanel />
        </TabsContent>
        <TabsContent value="results">
          <ResultSheet />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// --- Attendance ---

function AttendancePanel({ requestedSectionId }: { requestedSectionId?: string }) {
  // Only sections this teacher is the "first teacher" / delegated taker for;
  // submitting for any other section would be refused by the API anyway.
  const takable = useAttendanceSections();
  const options = takable.data?.items ?? [];
  const [sectionId, setSectionId] = React.useState("");
  const [date, setDate] = React.useState(todayIso());

  React.useEffect(() => {
    if (requestedSectionId && options.some((o) => o.id === requestedSectionId)) setSectionId(requestedSectionId);
    else if (!sectionId && options.length > 0) setSectionId(options[0].id);
  }, [options, sectionId, requestedSectionId]);

  if (takable.isLoading) return null;
  if (options.length === 0) {
    return (
      <EmptyState
        title="No attendance to take"
        description="You take attendance only for sections where an admin marked you as the first teacher."
      />
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="att-section">Section</Label>
            <Select id="att-section" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              {options.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="att-date">Date</Label>
            <Input id="att-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        {sectionId && <AttendanceWidget sectionId={sectionId} date={date} />}
      </CardContent>
    </Card>
  );
}

// --- Resources ---

function ResourcesPanel() {
  const { toast } = useToast();
  const { options, sectionId, setSectionId, current, isLoading } = useMySections();
  const resources = useResources(sectionId);
  const createResource = useCreateResource();
  const [open, setOpen] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [form, setForm] = React.useState({ title: "", kind: "pdf" as ResourceKind, url: "", subjectId: "" });

  async function handleFileUpload(file: File) {
    setUploading(true);
    try {
      const { url } = await apiUpload(file);
      setForm((f) => ({ ...f, url }));
      toast({ title: "File uploaded", description: file.name, variant: "success" });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not upload the file.";
      toast({ title: "Upload failed", description: message, variant: "error" });
    } finally {
      setUploading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!current) return;
    const parsed = createResourceSchema.safeParse({
      ...form,
      classId: current.classId,
      sectionId: current.id,
      publishNow: true,
    });
    if (!parsed.success) {
      toast({ title: "Check the form", description: parsed.error.issues[0]?.message, variant: "error" });
      return;
    }
    try {
      await createResource.mutateAsync(parsed.data);
      toast({ title: "Resource added", variant: "success" });
      setOpen(false);
      setForm({ title: "", kind: "pdf", url: "", subjectId: "" });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not add the resource.";
      toast({ title: "Could not add resource", description: message, variant: "error" });
    }
  }

  if (isLoading) return null;
  if (options.length === 0) return <EmptyState title="No sections assigned yet" />;

  return (
    <div>
      <PageHeader
        title="Materials"
        description="Upload a file or paste a link (Drive, YouTube, etc.)."
        actions={
          <div className="flex items-center gap-2">
            <Select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              {options.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
            <FormModal
              open={open}
              onOpenChange={setOpen}
              title="New resource"
              trigger={
                <Button size="sm">
                  <Plus className="h-4 w-4" /> New resource
                </Button>
              }
            >
              <form onSubmit={handleCreate} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="res-title">Title</Label>
                  <Input id="res-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="res-subject">Subject</Label>
                  <Select id="res-subject" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
                    <option value="">Select a subject</option>
                    {current?.subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="res-kind">Kind</Label>
                  <Select id="res-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as ResourceKind })}>
                    {RESOURCE_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k.replace("_", " ")}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Upload a file</Label>
                  <FileUploader onUpload={handleFileUpload} label={uploading ? "Uploading..." : "Click to upload or drag and drop"} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="res-url">Or paste a link</Label>
                  <Input id="res-url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
                </div>
                <Button type="submit" disabled={createResource.isPending || uploading} className="mt-2">
                  {createResource.isPending ? "Adding..." : uploading ? "Uploading..." : "Add & publish"}
                </Button>
              </form>
            </FormModal>
          </div>
        }
      />
      <DataTable
        columns={[
          { key: "title", header: "Title", render: (r) => r.title },
          { key: "kind", header: "Kind", render: (r) => <Badge variant="muted">{r.kind.replace("_", " ")}</Badge> },
          { key: "subject", header: "Subject", render: (r) => r.subjectName },
          { key: "link", header: "Link", render: (r) => <a href={r.url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">Open</a> },
        ]}
        data={resources.data?.items ?? []}
        keyField={(r) => r.id}
        isLoading={resources.isLoading}
        isError={resources.isError}
        onRetry={() => resources.refetch()}
        emptyTitle="No materials yet"
      />
    </div>
  );
}

// --- Assignments ---

function AssignmentsPanel() {
  const { toast } = useToast();
  const { options, sectionId, setSectionId, current, isLoading } = useMySections();
  const assignments = useAssignments(sectionId);
  const createAssignment = useCreateAssignment();
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ title: "", description: "", subjectId: "", dueAt: "" });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!current) return;
    const parsed = createAssignmentSchema.safeParse({
      ...form,
      sectionId: current.id,
      dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : "",
    });
    if (!parsed.success) {
      toast({ title: "Check the form", description: parsed.error.issues[0]?.message, variant: "error" });
      return;
    }
    try {
      await createAssignment.mutateAsync(parsed.data);
      toast({ title: "Assignment posted", variant: "success" });
      setOpen(false);
      setForm({ title: "", description: "", subjectId: "", dueAt: "" });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not post the assignment.";
      toast({ title: "Could not post", description: message, variant: "error" });
    }
  }

  if (isLoading) return null;
  if (options.length === 0) return <EmptyState title="No sections assigned yet" />;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Assignments"
        actions={
          <div className="flex items-center gap-2">
            <Select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              {options.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
            <FormModal
              open={open}
              onOpenChange={setOpen}
              title="New assignment"
              trigger={
                <Button size="sm">
                  <Plus className="h-4 w-4" /> New assignment
                </Button>
              }
            >
              <form onSubmit={handleCreate} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="as-title">Title</Label>
                  <Input id="as-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="as-subject">Subject</Label>
                  <Select id="as-subject" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
                    <option value="">Select a subject</option>
                    {current?.subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="as-desc">Description</Label>
                  <Textarea id="as-desc" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="as-due">Due</Label>
                  <Input id="as-due" type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
                </div>
                <Button type="submit" disabled={createAssignment.isPending} className="mt-2">
                  {createAssignment.isPending ? "Posting..." : "Post assignment"}
                </Button>
              </form>
            </FormModal>
          </div>
        }
      />
      <DataTable
        columns={[
          { key: "title", header: "Title", render: (a) => a.title },
          { key: "subject", header: "Subject", render: (a) => a.subjectName },
          { key: "due", header: "Due", render: (a) => new Date(a.dueAt).toLocaleString() },
          {
            key: "actions",
            header: "",
            render: (a) => (
              <Button variant="outline" size="sm" onClick={() => setSelected(a.id)}>
                Submissions
              </Button>
            ),
          },
        ]}
        data={assignments.data?.items ?? []}
        keyField={(a) => a.id}
        isLoading={assignments.isLoading}
        isError={assignments.isError}
        onRetry={() => assignments.refetch()}
        emptyTitle="No assignments yet"
      />
      {selected && <SubmissionsPanel assignmentId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function SubmissionsPanel({ assignmentId, onClose }: { assignmentId: string; onClose: () => void }) {
  const { toast } = useToast();
  const submissions = useSubmissions(assignmentId);
  const gradeSubmission = useGradeSubmission(assignmentId);
  const [grades, setGrades] = React.useState<Record<string, { grade: string; feedback: string }>>({});

  async function handleGrade(submissionId: string, publish: boolean) {
    const parsed = gradeSubmissionSchema.safeParse({
      grade: Number(grades[submissionId]?.grade ?? 0),
      feedback: grades[submissionId]?.feedback || undefined,
      publish,
    });
    if (!parsed.success) {
      toast({ title: "Enter a grade", variant: "error" });
      return;
    }
    try {
      await gradeSubmission.mutateAsync({ ...parsed.data, submissionId });
      toast({ title: publish ? "Grade published" : "Grade saved", variant: "success" });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not save the grade.";
      toast({ title: "Could not save", description: message, variant: "error" });
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle>Submissions</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {(submissions.data?.items ?? []).map((s) => (
          <div key={s.id} className="rounded-md border border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-800">{s.studentName}</p>
              {s.gradePublishedAt && <Badge variant="success">Published: {s.grade}</Badge>}
            </div>
            {s.body && <p className="mt-1 text-sm text-slate-600">{s.body}</p>}
            {s.fileUrl && (
              <a href={s.fileUrl} target="_blank" rel="noreferrer" className="text-sm text-brand-600 hover:underline">
                View file
              </a>
            )}
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Grade</Label>
                <Input
                  className="w-24"
                  type="number"
                  value={grades[s.id]?.grade ?? ""}
                  onChange={(e) => setGrades({ ...grades, [s.id]: { ...grades[s.id], grade: e.target.value, feedback: grades[s.id]?.feedback ?? "" } })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Feedback</Label>
                <Input
                  value={grades[s.id]?.feedback ?? ""}
                  onChange={(e) => setGrades({ ...grades, [s.id]: { ...grades[s.id], feedback: e.target.value, grade: grades[s.id]?.grade ?? "" } })}
                />
              </div>
              <Button size="sm" variant="outline" onClick={() => handleGrade(s.id, false)} disabled={gradeSubmission.isPending}>
                Save
              </Button>
              <Button size="sm" onClick={() => handleGrade(s.id, true)} disabled={gradeSubmission.isPending}>
                Save & publish
              </Button>
            </div>
          </div>
        ))}
        {submissions.data?.items.length === 0 && <p className="text-sm text-slate-400">No submissions yet.</p>}
      </CardContent>
    </Card>
  );
}

// --- Exams ---
// Exams are scheduled by the school (admin / coordinator). A teacher only
// enters marks for the subjects they teach and submits them for approval.

const EXAM_STATUS: Record<ExamStatus, { label: string; variant: "muted" | "warning" | "default" | "success" }> = {
  draft: { label: "Enter marks", variant: "muted" },
  submitted: { label: "Awaiting approval", variant: "warning" },
  approved: { label: "Approved", variant: "default" },
  published: { label: "Published", variant: "success" },
};

function ExamsPanel() {
  const exams = useExams();
  const [selected, setSelected] = React.useState<string | null>(null);
  const current = (exams.data?.items ?? []).find((e) => e.id === selected) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Exams" description="Enter marks for your subjects, then submit them to the coordinator for approval." />
      <DataTable
        columns={[
          { key: "name", header: "Exam", render: (e) => e.name },
          { key: "subject", header: "Subject", render: (e) => e.subjectName },
          { key: "section", header: "Section", render: (e) => e.sectionName },
          { key: "date", header: "Date", render: (e) => e.examDate },
          {
            key: "status", header: "Status", render: (e) => (
              <div>
                <Badge variant={EXAM_STATUS[e.status].variant}>{EXAM_STATUS[e.status].label}</Badge>
                {e.status === "draft" && e.returnNote && <p className="mt-1 max-w-xs text-xs text-amber-700">Returned: {e.returnNote}</p>}
              </div>
            ),
          },
          {
            key: "actions", header: "", render: (e) => (
              <Button variant="outline" size="sm" onClick={() => setSelected(e.id)}>
                {e.status === "draft" ? "Marks" : "View"}
              </Button>
            ),
          },
        ]}
        data={exams.data?.items ?? []}
        keyField={(e) => e.id}
        isLoading={exams.isLoading}
        isError={exams.isError}
        onRetry={() => exams.refetch()}
        emptyTitle="No exams for your subjects yet"
        emptyDescription="When the school schedules an exam for a class you teach, it shows up here."
      />
      {current && <MarksPanel exam={current} onClose={() => setSelected(null)} />}
    </div>
  );
}

function MarksPanel({ exam, onClose }: { exam: ExamDto; onClose: () => void }) {
  const { toast } = useToast();
  const roster = useSectionRoster(exam.sectionId);
  const marks = useMarks(exam.id);
  const submitMarks = useSubmitMarks();
  const submitExam = useSubmitExam();
  const [entries, setEntries] = React.useState<Record<string, string>>({});
  const [confirm, setConfirm] = React.useState(false);
  const locked = exam.status !== "draft";

  React.useEffect(() => {
    if (!marks.data) return;
    const next: Record<string, string> = {};
    for (const m of marks.data.items) next[m.studentId] = String(m.marksObtained);
    setEntries(next);
  }, [marks.data]);

  const students = roster.data?.items ?? [];
  const invalid = (id: string) => {
    const v = entries[id];
    if (v === undefined || v === "") return false;
    const n = Number(v);
    return !Number.isFinite(n) || n < 0 || n > exam.maxMarks;
  };
  const missing = students.filter((s) => entries[s.id] === undefined || entries[s.id] === "").length;
  const anyInvalid = students.some((s) => invalid(s.id));

  async function save(): Promise<boolean> {
    // Only rows the teacher actually filled — never silently store a 0 for a blank.
    const list = students.filter((s) => entries[s.id] !== undefined && entries[s.id] !== "").map((s) => ({ studentId: s.id, marksObtained: Number(entries[s.id]) }));
    if (list.length === 0) { toast({ title: "Enter at least one mark", variant: "error" }); return false; }
    try {
      await submitMarks.mutateAsync({ examId: exam.id, entries: list });
      toast({ title: "Marks saved", variant: "success" });
      return true;
    } catch (err) {
      toast({ title: "Could not save", description: errorMessage(err), variant: "error" });
      return false;
    }
  }

  async function submitForApproval() {
    setConfirm(false);
    if (!(await save())) return;
    try {
      await submitExam.mutateAsync(exam.id);
      toast({ title: "Submitted for approval", description: "The coordinator will review your marks.", variant: "success" });
      onClose();
    } catch (err) {
      toast({ title: "Could not submit", description: errorMessage(err), variant: "error" });
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle>{exam.subjectName} — {exam.sectionName} <span className="text-sm font-normal text-slate-500">(full marks {exam.maxMarks})</span></CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {locked && <p className="rounded-md bg-slate-50 p-2 text-sm text-slate-600">These marks are {EXAM_STATUS[exam.status].label.toLowerCase()} and can no longer be edited.</p>}
        {students.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-700">{s.name} {s.rollNumber && <span className="text-slate-400">· Roll {s.rollNumber}</span>}</p>
            <Input
              className={`w-24 ${invalid(s.id) ? "border-red-500" : ""}`}
              type="number" min={0} max={exam.maxMarks} step="0.5" disabled={locked}
              aria-label={`Marks for ${s.name}`} aria-invalid={invalid(s.id)}
              value={entries[s.id] ?? ""}
              onChange={(e) => setEntries({ ...entries, [s.id]: e.target.value })}
            />
          </div>
        ))}
        {!locked && (
          <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
            {missing > 0 && <span className="mr-auto text-xs text-slate-500">{missing} student(s) still blank</span>}
            {anyInvalid && <span className="mr-auto text-xs text-red-600">Marks must be between 0 and {exam.maxMarks}.</span>}
            <Button variant="outline" onClick={save} disabled={submitMarks.isPending || anyInvalid}>{submitMarks.isPending ? "Saving..." : "Save draft"}</Button>
            <Button onClick={() => setConfirm(true)} disabled={submitExam.isPending || anyInvalid || missing > 0}>Submit for approval</Button>
          </div>
        )}
      </CardContent>
      <ConfirmDialog
        open={confirm} onOpenChange={setConfirm} variant="default" confirmLabel="Submit"
        title="Submit these marks?" description="You cannot edit them afterwards unless the coordinator sends them back."
        onConfirm={submitForApproval} loading={submitExam.isPending}
      />
    </Card>
  );
}
