"use client";

import * as React from "react";
import { Button, DataTable, FormModal, PageHeader, useToast } from "@packages/ui";
import type { InvoiceDto } from "@packages/shared-types";
import { errorMessage } from "@/lib/errors";
import { formatTaka } from "@/lib/money";
import { useInitiateOnlinePayment, useInvoices, usePaymentOptions } from "@/lib/hooks/use-fees";
import { FeeStatusBadge } from "./fee-status-badge";
import { PaymentsDialog } from "./receipt-dialog";

const METHOD_LABEL = { bkash: "bKash", nagad: "Nagad", sslcommerz: "Card / Net banking (SSLCommerz)" } as const;

/** Parent / student view: what is due, pay online, and receipts for what was paid. */
export function MyFeesPanel() {
  const { toast } = useToast();
  const invoices = useInvoices();
  const options = usePaymentOptions();
  const initiate = useInitiateOnlinePayment();
  const [paying, setPaying] = React.useState<InvoiceDto | null>(null);
  const [receiptFor, setReceiptFor] = React.useState<InvoiceDto | null>(null);

  async function start(invoice: InvoiceDto, method: "bkash" | "nagad" | "sslcommerz") {
    try {
      const session = await initiate.mutateAsync({ invoiceId: invoice.id, method });
      window.location.href = session.redirectUrl; // hand over to the gateway
    } catch (err) {
      toast({ title: "Could not start the payment", description: errorMessage(err), variant: "error" });
    }
  }

  const methods = options.data?.methods ?? [];
  return (
    <div>
      <PageHeader title="Fees" description="What is due for your child, and every payment made." />
      {options.data?.sandbox && (
        <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Test mode: online payments use a practice checkout and no real money moves.</p>
      )}
      <DataTable
        columns={[
          { key: "student", header: "Student", render: (i) => i.studentName },
          { key: "fee", header: "Fee", render: (i) => `${i.feeStructureName} (${i.term})` },
          { key: "due", header: "Amount", render: (i) => formatTaka(i.amountDue) },
          { key: "paid", header: "Paid", render: (i) => formatTaka(i.amountPaid) },
          { key: "balance", header: "Balance", render: (i) => formatTaka(i.amountDue - i.amountPaid) },
          { key: "duedate", header: "Due date", render: (i) => new Date(i.dueDate).toLocaleDateString() },
          { key: "status", header: "Status", render: (i) => <FeeStatusBadge status={i.status} /> },
          {
            key: "actions", header: "", render: (i) => (
              <div className="flex gap-2">
                {i.status !== "paid" && methods.length > 0 && <Button size="sm" onClick={() => setPaying(i)}>Pay online</Button>}
                {i.amountPaid > 0 && <Button size="sm" variant="outline" onClick={() => setReceiptFor(i)}>Receipts</Button>}
              </div>
            ),
          },
        ]}
        data={invoices.data?.items ?? []}
        keyField={(i) => i.id}
        isLoading={invoices.isLoading}
        isError={invoices.isError}
        onRetry={() => invoices.refetch()}
        emptyTitle="No invoices yet"
      />

      <FormModal open={Boolean(paying)} onOpenChange={(o) => !o && setPaying(null)} title="Pay online" description={paying ? `${paying.feeStructureName} (${paying.term}) — balance ${formatTaka(paying.amountDue - paying.amountPaid)}` : undefined}>
        <div className="flex flex-col gap-2">
          {methods.map((m) => (
            <Button key={m} variant="outline" disabled={initiate.isPending} onClick={() => paying && start(paying, m)}>
              Pay with {METHOD_LABEL[m]}
            </Button>
          ))}
          <p className="text-xs text-slate-500">You will be taken to the payment provider and brought back here when you finish.</p>
        </div>
      </FormModal>

      <PaymentsDialog invoiceId={receiptFor?.id ?? null} title={receiptFor ? `Payments — ${receiptFor.feeStructureName} (${receiptFor.term})` : "Payments"} onClose={() => setReceiptFor(null)} />
    </div>
  );
}
