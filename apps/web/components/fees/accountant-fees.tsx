"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, DataTable, FormModal, Input, Label, PageHeader, Select, useToast } from "@packages/ui";
import {
  createFeeStructureSchema, createInvoiceSchema, generateInvoicesSchema, recordPaymentSchema,
  type FeeStructureDto, type InvoiceDto, type PaymentMethod,
} from "@packages/shared-types";
import { LookupCombobox } from "@/components/forms/lookup-combobox";
import { errorMessage } from "@/lib/errors";
import { formatTaka, takaToPaisa } from "@/lib/money";
import {
  useCreateFeeStructure, useCreateInvoice, useDeleteFeeStructure, useFeeStructures, useGenerateInvoices,
  useInvoices, useRecordPayment, useUpdateFeeStructure,
} from "@/lib/hooks/use-fees";
import { FeeStatusBadge } from "./fee-status-badge";
import { PaymentsDialog } from "./receipt-dialog";

const KINDS = [
  { value: "admission", label: "Admission (one-time)" },
  { value: "monthly", label: "Monthly tuition" },
  { value: "other", label: "Other (exam, trip…)" },
] as const;
type Kind = (typeof KINDS)[number]["value"];
const thisMonth = () => new Date().toISOString().slice(0, 7);

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>;
}

// --- Fee structures -----------------------------------------------------------

export function FeeStructuresPanel() {
  const { toast } = useToast();
  const structures = useFeeStructures();
  const create = useCreateFeeStructure();
  const update = useUpdateFeeStructure();
  const remove = useDeleteFeeStructure();
  const [editing, setEditing] = React.useState<FeeStructureDto | null>(null);
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", classId: "", year: String(new Date().getFullYear()), amount: "", kind: "monthly" as Kind });

  function openFor(f: FeeStructureDto | null) {
    setEditing(f);
    setForm(f ? { name: f.name, classId: f.classId, year: String(f.year), amount: String(f.amount / 100), kind: f.kind } : { name: "", classId: "", year: String(new Date().getFullYear()), amount: "", kind: "monthly" });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const amount = takaToPaisa(form.amount);
    if (amount === null) return toast({ title: "Enter the amount in Taka, e.g. 2500 or 2500.50", variant: "error" });
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, name: form.name, amount, kind: form.kind });
        toast({ title: "Fee structure updated", description: "Invoices already raised keep their old amount.", variant: "success" });
      } else {
        const parsed = createFeeStructureSchema.safeParse({ name: form.name, classId: form.classId, year: Number(form.year), amount, kind: form.kind });
        if (!parsed.success) return toast({ title: "Check the form", description: parsed.error.issues[0]?.message, variant: "error" });
        await create.mutateAsync(parsed.data);
        toast({ title: "Fee structure created", variant: "success" });
      }
      setOpen(false);
    } catch (err) {
      toast({ title: "Could not save", description: errorMessage(err), variant: "error" });
    }
  }

  async function del(f: FeeStructureDto) {
    if (!window.confirm(`Delete “${f.name}” for ${f.className}? Existing invoices are kept.`)) return;
    try {
      await remove.mutateAsync(f.id);
      toast({ title: "Fee structure deleted", variant: "success" });
    } catch (err) {
      toast({ title: "Could not delete", description: errorMessage(err), variant: "error" });
    }
  }

  return (
    <div>
      <PageHeader
        title="Fee structures"
        description="The price list per class. Pick the type so admission and monthly billing know which to use."
        actions={<Button size="sm" onClick={() => openFor(null)}><Plus className="h-4 w-4" /> New structure</Button>}
      />
      <FormModal open={open} onOpenChange={setOpen} title={editing ? "Edit fee structure" : "New fee structure"}>
        <form onSubmit={save} className="flex flex-col gap-4">
          <Field id="fs-name" label="Name"><Input id="fs-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          {!editing && (
            <Field id="fs-class" label="Class"><LookupCombobox id="fs-class" kind="classes" value={form.classId} onChange={(v) => setForm({ ...form, classId: v })} /></Field>
          )}
          <Field id="fs-kind" label="Type">
            <Select id="fs-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })}>
              {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </Select>
          </Field>
          {!editing && <Field id="fs-year" label="Year"><Input id="fs-year" type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></Field>}
          <Field id="fs-amount" label="Amount (৳ Taka)"><Input id="fs-amount" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="e.g. 2500" /></Field>
          <Button type="submit" disabled={create.isPending || update.isPending}>{editing ? "Save changes" : "Create structure"}</Button>
        </form>
      </FormModal>
      <DataTable
        columns={[
          { key: "name", header: "Name", render: (f) => f.name },
          { key: "kind", header: "Type", render: (f) => <Badge variant="muted">{f.kind}</Badge> },
          { key: "class", header: "Class", render: (f) => f.className },
          { key: "year", header: "Year", render: (f) => String(f.year) },
          { key: "amount", header: "Amount", render: (f) => formatTaka(f.amount) },
          { key: "actions", header: "", render: (f) => (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => openFor(f)}>Edit</Button>
              <Button size="sm" variant="outline" disabled={remove.isPending} onClick={() => del(f)}>Delete</Button>
            </div>
          ) },
        ]}
        data={structures.data?.items ?? []}
        keyField={(f) => f.id}
        isLoading={structures.isLoading}
        isError={structures.isError}
        onRetry={() => structures.refetch()}
        emptyTitle="No fee structures yet"
      />
    </div>
  );
}

// --- Monthly generation ---------------------------------------------------------

export function GenerateFeesPanel() {
  const { toast } = useToast();
  const structures = useFeeStructures();
  const generate = useGenerateInvoices();
  const [form, setForm] = React.useState({ feeStructureId: "", term: thisMonth(), dueDate: "", sectionId: "" });
  const chosen = structures.data?.items.find((f) => f.id === form.feeStructureId);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    const parsed = generateInvoicesSchema.safeParse({ ...form, sectionId: form.sectionId || undefined });
    if (!parsed.success) return toast({ title: "Check the form", description: parsed.error.issues[0]?.message, variant: "error" });
    if (!window.confirm(`Bill “${chosen?.name}” (${chosen ? formatTaka(chosen.amount) : ""}) for ${form.term}${form.sectionId ? " to the chosen section" : ` to every student of ${chosen?.className}`}? Parents are notified.`)) return;
    try {
      const r = await generate.mutateAsync(parsed.data);
      toast({
        title: `${r.created} invoice${r.created === 1 ? "" : "s"} created`,
        description: r.skipped ? `${r.skipped} student(s) already had this bill and were skipped.` : "Parents have been notified.",
        variant: "success",
      });
    } catch (err) {
      toast({ title: "Could not generate", description: errorMessage(err), variant: "error" });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate monthly fees</CardTitle>
        <p className="text-sm text-slate-500">Bills every active student of the class in one go. Safe to run again: nobody is billed twice for the same month.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={run} className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <Field id="gen-fee" label="Fee">
            <LookupCombobox id="gen-fee" kind="feeStructures" value={form.feeStructureId} onChange={(v) => setForm({ ...form, feeStructureId: v, sectionId: "" })} placeholder="Search fee…" />
          </Field>
          <Field id="gen-term" label="Billing month"><Input id="gen-term" value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} placeholder="2026-10" /></Field>
          <Field id="gen-section" label="Section (optional, default: whole class)">
            <LookupCombobox id="gen-section" kind="sections" value={form.sectionId} filters={{ classId: chosen?.classId }} disabled={!chosen} clearable onChange={(v) => setForm({ ...form, sectionId: v })} placeholder="All sections" />
          </Field>
          <Field id="gen-due" label="Due date"><Input id="gen-due" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Button type="submit" disabled={generate.isPending}>{generate.isPending ? "Generating…" : "Generate invoices"}</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}

// --- Invoices ---------------------------------------------------------------------

export function InvoicesPanel() {
  const { toast } = useToast();
  const [studentId, setStudentId] = React.useState("");
  const invoices = useInvoices(studentId || undefined);
  const createInvoice = useCreateInvoice();
  const recordPayment = useRecordPayment();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ studentId: "", feeStructureId: "", term: thisMonth(), dueDate: "" });
  const [payFor, setPayFor] = React.useState<InvoiceDto | null>(null);
  const [payForm, setPayForm] = React.useState({ amount: "", method: "cash" as PaymentMethod, transactionRef: "" });
  const [receiptFor, setReceiptFor] = React.useState<InvoiceDto | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const parsed = createInvoiceSchema.safeParse(form);
    if (!parsed.success) return toast({ title: "Check the form", description: parsed.error.issues[0]?.message, variant: "error" });
    try {
      await createInvoice.mutateAsync(parsed.data);
      toast({ title: "Invoice created", variant: "success" });
      setOpen(false);
    } catch (err) {
      toast({ title: "Could not create invoice", description: errorMessage(err), variant: "error" });
    }
  }

  function openPay(i: InvoiceDto) {
    setPayFor(i);
    setPayForm({ amount: String((i.amountDue - i.amountPaid) / 100), method: "cash", transactionRef: "" });
  }
  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!payFor) return;
    const amount = takaToPaisa(payForm.amount);
    const parsed = recordPaymentSchema.safeParse({ invoiceId: payFor.id, amount, method: payForm.method, transactionRef: payForm.transactionRef || undefined });
    if (amount === null || amount === 0 || !parsed.success) return toast({ title: "Enter a valid amount in Taka", variant: "error" });
    try {
      await recordPayment.mutateAsync(parsed.data);
      toast({ title: "Payment recorded", variant: "success" });
      setPayFor(null);
    } catch (err) {
      toast({ title: "Could not record payment", description: errorMessage(err), variant: "error" });
    }
  }

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Everything billed. Record cash or bank payments here; online payments appear automatically."
        actions={<Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New invoice</Button>}
      />
      <div className="mb-4 w-72">
        <LookupCombobox kind="students" value={studentId} onChange={setStudentId} placeholder="Filter by student…" clearable />
      </div>

      <FormModal open={open} onOpenChange={setOpen} title="New invoice" description="For a one-off charge. Use “Generate monthly fees” for whole classes.">
        <form onSubmit={create} className="flex flex-col gap-4">
          <Field id="inv-student" label="Student"><LookupCombobox id="inv-student" kind="students" value={form.studentId} onChange={(v) => setForm({ ...form, studentId: v })} /></Field>
          <Field id="inv-fee" label="Fee"><LookupCombobox id="inv-fee" kind="feeStructures" value={form.feeStructureId} onChange={(v) => setForm({ ...form, feeStructureId: v })} /></Field>
          <Field id="inv-term" label="Term / month"><Input id="inv-term" value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} /></Field>
          <Field id="inv-due" label="Due date"><Input id="inv-due" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
          <Button type="submit" disabled={createInvoice.isPending}>Create invoice</Button>
        </form>
      </FormModal>

      <FormModal open={Boolean(payFor)} onOpenChange={(o) => !o && setPayFor(null)} title={payFor ? `Record payment — ${payFor.studentName}` : "Record payment"} description={payFor ? `${payFor.feeStructureName} (${payFor.term}) · balance ${formatTaka(payFor.amountDue - payFor.amountPaid)}` : undefined}>
        <form onSubmit={pay} className="flex flex-col gap-4">
          <Field id="pay-amount" label="Amount (৳ Taka)"><Input id="pay-amount" inputMode="decimal" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} /></Field>
          <Field id="pay-method" label="Method">
            <Select id="pay-method" value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value as PaymentMethod })}>
              <option value="cash">Cash</option><option value="bkash">bKash</option><option value="nagad">Nagad</option><option value="sslcommerz">Card / bank</option>
            </Select>
          </Field>
          <Field id="pay-ref" label="Transaction reference (optional)"><Input id="pay-ref" value={payForm.transactionRef} onChange={(e) => setPayForm({ ...payForm, transactionRef: e.target.value })} /></Field>
          <Button type="submit" disabled={recordPayment.isPending}>{recordPayment.isPending ? "Recording…" : "Record payment"}</Button>
        </form>
      </FormModal>

      <PaymentsDialog invoiceId={receiptFor?.id ?? null} title={receiptFor ? `Payments — ${receiptFor.studentName}` : "Payments"} onClose={() => setReceiptFor(null)} />

      <DataTable
        columns={[
          { key: "student", header: "Student", render: (i) => i.studentName },
          { key: "fee", header: "Fee", render: (i) => `${i.feeStructureName} (${i.term})` },
          { key: "due", header: "Amount", render: (i) => formatTaka(i.amountDue) },
          { key: "paid", header: "Paid", render: (i) => formatTaka(i.amountPaid) },
          { key: "status", header: "Status", render: (i) => <FeeStatusBadge status={i.status} /> },
          { key: "actions", header: "", render: (i) => (
            <div className="flex gap-2">
              {i.status !== "paid" && <Button size="sm" variant="outline" onClick={() => openPay(i)}>Record payment</Button>}
              {i.amountPaid > 0 && <Button size="sm" variant="outline" onClick={() => setReceiptFor(i)}>Receipts</Button>}
            </div>
          ) },
        ]}
        data={invoices.data?.items ?? []}
        keyField={(i) => i.id}
        isLoading={invoices.isLoading}
        isError={invoices.isError}
        onRetry={() => invoices.refetch()}
        emptyTitle="No invoices yet"
      />
    </div>
  );
}
