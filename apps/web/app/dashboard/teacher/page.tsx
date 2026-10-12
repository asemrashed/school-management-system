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
  createExamSchema,
  RESOURCE_KINDS,
  type ResourceKind,
  type ExamType,
} from "@packages/shared-types";
import { useSession } from "@/lib/hooks/use-auth";
import { AttendanceWidget } from "@/components/attendance/attendance-widget";
import { apiUpload, ApiError } from "@/lib/api-client";
import { useClassAssignments, useSectionRoster, useAttendanceSections } from "@/lib/hooks/use-academics";
import { MyRoutine } from "@/components/routine/my-routine";
import { useResources, useCreateResource } from "@/lib/hooks/use-resources";
import { useAssignments, useCreateAssignment, useSubmissions, useGradeSubmission } from "@/lib/hooks/use-assignments";
import { useExams, useCreateExam, useMarks, useSubmitMarks, usePublishExam } from "@/lib/hooks/use-exams";

import { TodayPanel, localIsoDate } from "@/components/attendance/today-panel";

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
  const [tab, setTab] = React.useState("today");
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

function ExamsPanel() {
  const { toast } = useToast();
  const { options, sectionId, setSectionId, current, isLoading } = useMySections();
  const exams = useExams(sectionId);
  const createExam = useCreateExam();
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ name: "", type: "offline" as ExamType, subjectId: "", examDate: todayIso(), maxMarks: 100 });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!current) return;
    const parsed = createExamSchema.safeParse({ ...form, sectionId: current.id });
    if (!parsed.success) {
      toast({ title: "Check the form", description: parsed.error.issues[0]?.message, variant: "error" });
      return;
    }
    try {
      await createExam.mutateAsync(parsed.data);
      toast({ title: "Exam created", variant: "success" });
      setOpen(false);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not create the exam.";
      toast({ title: "Could not create", description: message, variant: "error" });
    }
  }

  if (isLoading) return null;
  if (options.length === 0) return <EmptyState title="No sections assigned yet" />;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Exams"
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
              title="New exam"
              trigger={
                <Button size="sm">
                  <Plus className="h-4 w-4" /> New exam
                </Button>
              }
            >
              <form onSubmit={handleCreate} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ex-name">Name</Label>
                  <Input id="ex-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ex-subject">Subject</Label>
                  <Select id="ex-subject" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
                    <option value="">Select a subject</option>
                    {current?.subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ex-type">Type</Label>
                  <Select id="ex-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ExamType })}>
                    <option value="offline">Offline</option>
                    <option value="online">Online</option>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ex-date">Date</Label>
                  <Input id="ex-date" type="date" value={form.examDate} onChange={(e) => setForm({ ...form, examDate: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ex-max">Max marks</Label>
                  <Input id="ex-max" type="number" value={form.maxMarks} onChange={(e) => setForm({ ...form, maxMarks: Number(e.target.value) })} />
                </div>
                <Button type="submit" disabled={createExam.isPending} className="mt-2">
                  {createExam.isPending ? "Creating..." : "Create exam"}
                </Button>
              </form>
            </FormModal>
          </div>
        }
      />
      <DataTable
        columns={[
          { key: "name", header: "Name", render: (e) => e.name },
          { key: "subject", header: "Subject", render: (e) => e.subjectName },
          { key: "date", header: "Date", render: (e) => e.examDate },
          { key: "status", header: "Status", render: (e) => <Badge variant={e.publishedAt ? "success" : "muted"}>{e.publishedAt ? "Published" : "Draft"}</Badge> },
          {
            key: "actions",
            header: "",
            render: (e) => (
              <Button variant="outline" size="sm" onClick={() => setSelected(e.id)}>
                Marks
              </Button>
            ),
          },
        ]}
        data={exams.data?.items ?? []}
        keyField={(e) => e.id}
        isLoading={exams.isLoading}
        isError={exams.isError}
        onRetry={() => exams.refetch()}
        emptyTitle="No exams yet"
      />
      {selected && current && (
        <MarksPanel examId={selected} sectionId={current.id} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function MarksPanel({ examId, sectionId, onClose }: { examId: string; sectionId: string; onClose: () => void }) {
  const { toast } = useToast();
  const roster = useSectionRoster(sectionId);
  const marks = useMarks(examId);
  const submitMarks = useSubmitMarks();
  const publishExam = usePublishExam();
  const [entries, setEntries] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!marks.data) return;
    const next: Record<string, string> = {};
    for (const m of marks.data.items) next[m.studentId] = String(m.marksObtained);
    setEntries(next);
  }, [marks.data]);

  async function handleSave() {
    const entryList = (roster.data?.items ?? []).map((s) => ({
      studentId: s.id,
      marksObtained: Number(entries[s.id] ?? 0),
    }));
    try {
      await submitMarks.mutateAsync({ examId, entries: entryList });
      toast({ title: "Marks saved", variant: "success" });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not save marks.";
      toast({ title: "Could not save", description: message, variant: "error" });
    }
  }

  async function handlePublish() {
    try {
      await publishExam.mutateAsync(examId);
      toast({ title: "Result published — guardians notified", variant: "success" });
      onClose();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not publish.";
      toast({ title: "Could not publish", description: message, variant: "error" });
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle>Marks entry</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {(roster.data?.items ?? []).map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-700">{s.name} {s.rollNumber && <span className="text-slate-400">· Roll {s.rollNumber}</span>}</p>
            <Input
              className="w-24"
              type="number"
              value={entries[s.id] ?? ""}
              onChange={(e) => setEntries({ ...entries, [s.id]: e.target.value })}
            />
          </div>
        ))}
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={handleSave} disabled={submitMarks.isPending}>
            {submitMarks.isPending ? "Saving..." : "Save marks"}
          </Button>
          <Button onClick={handlePublish} disabled={publishExam.isPending}>
            {publishExam.isPending ? "Publishing..." : "Publish result"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
