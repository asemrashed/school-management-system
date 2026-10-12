"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, Checkbox, DataTable, FormModal, Input, Label, Select, useToast,
} from "@packages/ui";
import { admitStudentSchema, type AdmissionApplicationDto, type AdmitStudentInput, type StudentDto } from "@packages/shared-types";
import { LookupCombobox } from "@/components/forms/lookup-combobox";
import { errorMessage } from "@/lib/errors";
import { formatTaka } from "@/lib/money";
import { useFeeStructures } from "@/lib/hooks/use-fees";
import { useDebounced } from "@/lib/hooks/use-setup";
import {
  useAdmitStudent, useApplications, useRejectApplication, useStudents, useUpdateStudent,
} from "@/lib/hooks/use-students";

/** Admin: enrolled students (search / filter / enable-disable) + the admission desk. */
export function StudentsPanel() {
  const { toast } = useToast();
  const [q, setQ] = React.useState("");
  const [sectionId, setSectionId] = React.useState("");
  const [page, setPage] = React.useState(1);
  const debounced = useDebounced(q, 300);
  const students = useStudents({ q: debounced, sectionId, page });
  const update = useUpdateStudent();
  const [admitOpen, setAdmitOpen] = React.useState(false);
  const [prefill, setPrefill] = React.useState<AdmissionApplicationDto | null>(null);

  React.useEffect(() => setPage(1), [debounced, sectionId]);
  const total = students.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 20));

  async function toggleActive(s: StudentDto) {
    try {
      await update.mutateAsync({ id: s.id, isActive: !s.isActive });
      toast({ title: s.isActive ? "Student disabled" : "Student enabled", variant: "success" });
    } catch (err) {
      toast({ title: "Could not update", description: errorMessage(err), variant: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Students</CardTitle>
          <Button size="sm" onClick={() => { setPrefill(null); setAdmitOpen(true); }}>
            <Plus className="h-4 w-4" /> Admit student
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input className="w-64" placeholder="Search by name…" aria-label="Search students" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="w-64">
              <LookupCombobox kind="sections" value={sectionId} onChange={setSectionId} placeholder="All sections" clearable />
            </div>
          </div>
          <DataTable
            columns={[
              { key: "code", header: "ID", render: (s) => s.studentCode ?? "—" },
              { key: "name", header: "Name", render: (s) => <div><div className="font-medium">{s.name}</div><div className="text-xs text-slate-500">{s.email}</div></div> },
              { key: "section", header: "Section", render: (s) => (s.sectionLabel ? `${s.sectionLabel}${s.rollNumber ? ` · Roll ${s.rollNumber}` : ""}` : "—") },
              { key: "guardian", header: "Guardian", render: (s) => (s.guardianName ? `${s.guardianName}${s.guardianPhone ? ` · ${s.guardianPhone}` : ""}` : "—") },
              { key: "status", header: "Status", render: (s) => <Badge variant={s.isActive ? "success" : "danger"}>{s.isActive ? "Active" : "Disabled"}</Badge> },
              { key: "actions", header: "", render: (s) => <Button size="sm" variant="outline" disabled={update.isPending} onClick={() => toggleActive(s)}>{s.isActive ? "Disable" : "Enable"}</Button> },
            ]}
            data={students.data?.items ?? []}
            keyField={(s) => s.id}
            isLoading={students.isLoading}
            isError={students.isError}
            onRetry={() => students.refetch()}
            emptyTitle="No students found"
            emptyDescription="Use “Admit student” to enrol the first one."
            footer={
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>{total} student{total === 1 ? "" : "s"}</span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                  <span>Page {page} of {pages}</span>
                  <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            }
          />
        </CardContent>
      </Card>

      <ApplicationsInbox onAdmit={(a) => { setPrefill(a); setAdmitOpen(true); }} />

      <AdmitStudentModal open={admitOpen} onOpenChange={setAdmitOpen} prefill={prefill} />
    </div>
  );
}

function ApplicationsInbox({ onAdmit }: { onAdmit: (a: AdmissionApplicationDto) => void }) {
  const { toast } = useToast();
  const apps = useApplications("new");
  const reject = useRejectApplication();

  async function doReject(a: AdmissionApplicationDto) {
    const reviewNote = window.prompt(`Reject ${a.studentName}'s application? Optional note:`, "");
    if (reviewNote === null) return; // cancelled
    try {
      await reject.mutateAsync({ id: a.id, reviewNote: reviewNote || undefined });
      toast({ title: "Application rejected", variant: "success" });
    } catch (err) {
      toast({ title: "Could not reject", description: errorMessage(err), variant: "error" });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admission applications</CardTitle>
        <p className="text-sm text-slate-500">Submitted from the public website. “Admit” opens the admission form pre-filled.</p>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={[
            { key: "student", header: "Applicant", render: (a) => <div><div className="font-medium">{a.studentName}</div><div className="text-xs text-slate-500">{a.appliedClassName ?? "—"}{a.previousSchool ? ` · from ${a.previousSchool}` : ""}</div></div> },
            { key: "guardian", header: "Guardian", render: (a) => <div><div>{a.guardianName}</div><div className="text-xs text-slate-500">{a.guardianPhone} · {a.guardianEmail}</div></div> },
            { key: "date", header: "Applied", render: (a) => new Date(a.createdAt).toLocaleDateString() },
            {
              key: "actions", header: "", render: (a) => (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => onAdmit(a)}>Admit</Button>
                  <Button size="sm" variant="outline" disabled={reject.isPending} onClick={() => doReject(a)}>Reject</Button>
                </div>
              ),
            },
          ]}
          data={apps.data?.items ?? []}
          keyField={(a) => a.id}
          isLoading={apps.isLoading}
          isError={apps.isError}
          onRetry={() => apps.refetch()}
          emptyTitle="No new applications"
        />
      </CardContent>
    </Card>
  );
}

const emptyForm = {
  name: "", email: "", classId: "", sectionId: "", dateOfBirth: "", gender: "", address: "", dueDate: "",
  guardianMode: "new" as "new" | "existing",
  guardianId: "", gName: "", gEmail: "", gPhone: "",
};

function AdmitStudentModal({ open, onOpenChange, prefill }: { open: boolean; onOpenChange: (o: boolean) => void; prefill: AdmissionApplicationDto | null }) {
  const { toast } = useToast();
  const admit = useAdmitStudent();
  const structures = useFeeStructures();
  const [form, setForm] = React.useState(emptyForm);
  const [customFees, setCustomFees] = React.useState(false);
  const [feeIds, setFeeIds] = React.useState<string[]>([]);
  const set = <K extends keyof typeof emptyForm>(k: K, v: (typeof emptyForm)[K]) => setForm((f) => ({ ...f, [k]: v }));

  // (Re)initialise whenever the dialog opens, from an application if there is one.
  React.useEffect(() => {
    if (!open) return;
    setCustomFees(false);
    setFeeIds([]);
    setForm(
      prefill
        ? { ...emptyForm, name: prefill.studentName, classId: prefill.appliedClassId ?? "", dateOfBirth: prefill.dateOfBirth ?? "", gender: prefill.gender ?? "", address: prefill.address ?? "", gName: prefill.guardianName, gEmail: prefill.guardianEmail, gPhone: prefill.guardianPhone }
        : emptyForm
    );
  }, [open, prefill]);

  const classFees = (structures.data?.items ?? []).filter((f) => f.classId === form.classId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const candidate = {
      name: form.name,
      email: form.email,
      sectionId: form.sectionId,
      dateOfBirth: form.dateOfBirth || undefined,
      gender: form.gender || undefined,
      address: form.address || undefined,
      dueDate: form.dueDate || undefined,
      applicationId: prefill?.id,
      feeStructureIds: customFees ? feeIds : undefined,
      guardian: form.guardianMode === "existing" ? { guardianId: form.guardianId } : { name: form.gName, email: form.gEmail, phone: form.gPhone },
    };
    const parsed = admitStudentSchema.safeParse(candidate);
    if (!parsed.success) {
      toast({ title: "Check the form", description: parsed.error.issues[0]?.message, variant: "error" });
      return;
    }
    try {
      const result = await admit.mutateAsync(parsed.data as AdmitStudentInput);
      const total = result.invoices.reduce((n, i) => n + i.amountDue, 0);
      toast({
        title: `${result.student.name} admitted`,
        description: `ID ${result.student.studentCode} · Roll ${result.student.rollNumber} · ${result.invoices.length} invoice(s), ${formatTaka(total)} billed. Login details were emailed${result.guardianCreated ? " to the student and the new guardian" : ""}.`,
        variant: "success",
      });
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Could not admit student", description: errorMessage(err), variant: "error" });
    }
  }

  return (
    <FormModal open={open} onOpenChange={onOpenChange} title="Admit student" description="Creates the account, places the student in a section and raises the admission invoices.">
      <form onSubmit={submit} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="ad-name" label="Student name"><Input id="ad-name" value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field id="ad-email" label="Student login email"><Input id="ad-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field id="ad-class" label="Class">
            <LookupCombobox id="ad-class" kind="classes" value={form.classId} onChange={(v) => setForm((f) => ({ ...f, classId: v, sectionId: "" }))} />
          </Field>
          <Field id="ad-section" label="Section">
            <LookupCombobox id="ad-section" kind="sections" value={form.sectionId} filters={{ classId: form.classId }} disabled={!form.classId} onChange={(v) => set("sectionId", v)} placeholder={form.classId ? "Select section…" : "Choose a class first"} />
          </Field>
          <Field id="ad-dob" label="Date of birth"><Input id="ad-dob" type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} /></Field>
          <Field id="ad-gender" label="Gender">
            <Select id="ad-gender" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
              <option value="">—</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
            </Select>
          </Field>
        </div>
        <Field id="ad-address" label="Address"><Input id="ad-address" value={form.address} onChange={(e) => set("address", e.target.value)} /></Field>

        <fieldset className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-sm font-medium text-slate-700">Guardian</legend>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="radio" checked={form.guardianMode === "new"} onChange={() => set("guardianMode", "new")} /> New guardian</label>
            <label className="flex items-center gap-2"><input type="radio" checked={form.guardianMode === "existing"} onChange={() => set("guardianMode", "existing")} /> Existing (siblings)</label>
          </div>
          {form.guardianMode === "existing" ? (
            <Field id="ad-guardian" label="Search guardian"><LookupCombobox id="ad-guardian" kind="guardians" value={form.guardianId} onChange={(v) => set("guardianId", v)} /></Field>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field id="ad-gname" label="Name"><Input id="ad-gname" value={form.gName} onChange={(e) => set("gName", e.target.value)} /></Field>
              <Field id="ad-gemail" label="Email"><Input id="ad-gemail" type="email" value={form.gEmail} onChange={(e) => set("gEmail", e.target.value)} /></Field>
              <Field id="ad-gphone" label="Phone"><Input id="ad-gphone" value={form.gPhone} onChange={(e) => set("gPhone", e.target.value)} /></Field>
            </div>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-sm font-medium text-slate-700">Fees to bill now</legend>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={customFees} onChange={(e) => setCustomFees(e.target.checked)} />
            Choose fees manually (default: admission fee + this month's tuition)
          </label>
          {customFees && (form.classId ? (
            classFees.length ? classFees.map((f) => (
              <label key={f.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <Checkbox checked={feeIds.includes(f.id)} onChange={(e) => setFeeIds((ids) => (e.target.checked ? [...ids, f.id] : ids.filter((x) => x !== f.id)))} />
                  {f.name} <Badge variant="muted">{f.kind}</Badge>
                </span>
                <span className="text-slate-600">{formatTaka(f.amount)}</span>
              </label>
            )) : <p className="text-sm text-slate-500">This class has no fee structures yet. Add them under Fees.</p>
          ) : <p className="text-sm text-slate-500">Choose a class first.</p>)}
          <Field id="ad-due" label="Due date (default: 10 days from now)"><Input id="ad-due" type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} /></Field>
        </fieldset>

        <Button type="submit" disabled={admit.isPending}>{admit.isPending ? "Admitting…" : "Admit student"}</Button>
      </form>
    </FormModal>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>;
}
