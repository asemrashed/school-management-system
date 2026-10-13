"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import {
  PageHeader,
  DataTable,
  Button,
  Badge,
  FormModal,
  Input,
  Label,
  Select,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  useToast,
} from "@packages/ui";
import { createSalarySchema } from "@packages/shared-types";
import { FeeStructuresPanel, GenerateFeesPanel, InvoicesPanel } from "@/components/fees/accountant-fees";
import { LookupCombobox } from "@/components/forms/lookup-combobox";
import { useSalaries, useCreateSalary, useMarkSalaryPaid } from "@/lib/hooks/use-salary";
import { ApiError } from "@/lib/api-client";
import { useUrlTab } from "@/lib/use-url-tab";

const TAB_VALUES = ["invoices", "generate", "structures", "salaries"] as const;

export default function AccountantDashboardPage() {
  const [tab, setTab] = useUrlTab("tab", "invoices", TAB_VALUES);
  return (
    <div>
      <PageHeader title="Fees" description="Fee structures, invoices, payments and salaries." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="generate">Generate monthly fees</TabsTrigger>
          <TabsTrigger value="structures">Fee structures</TabsTrigger>
          <TabsTrigger value="salaries">Salaries</TabsTrigger>
        </TabsList>
        <TabsContent value="invoices">
          <InvoicesPanel />
        </TabsContent>
        <TabsContent value="generate">
          <GenerateFeesPanel />
        </TabsContent>
        <TabsContent value="structures">
          <FeeStructuresPanel />
        </TabsContent>
        <TabsContent value="salaries">
          <SalariesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SalariesPanel() {
  const { toast } = useToast();
  const salaries = useSalaries();
  const createSalary = useCreateSalary();
  const markPaid = useMarkSalaryPaid();
  const [open, setOpen] = React.useState(false);
  const now = new Date();
  const [form, setForm] = React.useState({
    staffId: "",
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    baseAmount: 0,
    deductions: 0,
    bonuses: 0,
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const parsed = createSalarySchema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Check the form", description: parsed.error.issues[0]?.message, variant: "error" });
      return;
    }
    try {
      await createSalary.mutateAsync(parsed.data);
      toast({ title: "Salary run saved", variant: "success" });
      setOpen(false);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not save the salary run.";
      toast({ title: "Could not save", description: message, variant: "error" });
    }
  }

  return (
    <div>
      <PageHeader
        title="Salaries"
        description="One row per staff member per month. Payslip = this row, printable from their own view."
        actions={
          <FormModal
            open={open}
            onOpenChange={setOpen}
            title="New / update salary run"
            description="Re-submitting the same staff + month + year updates that run."
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" /> New salary run
              </Button>
            }
          >
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sal-staff">Staff member</Label>
                <LookupCombobox id="sal-staff" kind="staff" value={form.staffId} onChange={(v) => setForm({ ...form, staffId: v })} placeholder="Search staff…" />
              </div>
              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="sal-month">Month</Label>
                  <Input
                    id="sal-month"
                    type="number"
                    min={1}
                    max={12}
                    value={form.month}
                    onChange={(e) => setForm({ ...form, month: Number(e.target.value) })}
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="sal-year">Year</Label>
                  <Input
                    id="sal-year"
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sal-base">Base amount (paisa)</Label>
                <Input
                  id="sal-base"
                  type="number"
                  value={form.baseAmount}
                  onChange={(e) => setForm({ ...form, baseAmount: Number(e.target.value) })}
                />
              </div>
              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="sal-deductions">Deductions</Label>
                  <Input
                    id="sal-deductions"
                    type="number"
                    value={form.deductions}
                    onChange={(e) => setForm({ ...form, deductions: Number(e.target.value) })}
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="sal-bonuses">Bonuses</Label>
                  <Input
                    id="sal-bonuses"
                    type="number"
                    value={form.bonuses}
                    onChange={(e) => setForm({ ...form, bonuses: Number(e.target.value) })}
                  />
                </div>
              </div>
              <Button type="submit" disabled={createSalary.isPending} className="mt-2">
                {createSalary.isPending ? "Saving..." : "Save"}
              </Button>
            </form>
          </FormModal>
        }
      />
      <DataTable
        columns={[
          { key: "staff", header: "Staff", render: (s) => `${s.staffName} (${s.staffRole})` },
          { key: "period", header: "Period", render: (s) => `${s.month}/${s.year}` },
          { key: "net", header: "Net pay", render: (s) => `৳${(s.netAmount / 100).toFixed(2)}` },
          {
            key: "status",
            header: "Status",
            render: (s) => (
              <Badge variant={s.paidAt ? "success" : "muted"}>{s.paidAt ? "Paid" : "Pending"}</Badge>
            ),
          },
          {
            key: "actions",
            header: "",
            render: (s) =>
              !s.paidAt && (
                <Button variant="outline" size="sm" onClick={() => markPaid.mutate(s.id)} disabled={markPaid.isPending}>
                  Mark paid
                </Button>
              ),
          },
        ]}
        data={salaries.data?.items ?? []}
        keyField={(s) => s.id}
        isLoading={salaries.isLoading}
        isError={salaries.isError}
        onRetry={() => salaries.refetch()}
        emptyTitle="No salary runs yet"
      />
    </div>
  );
}
