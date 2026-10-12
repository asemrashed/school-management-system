"use client";

import * as React from "react";
import { Button, FormModal } from "@packages/ui";
import { formatTaka } from "@/lib/money";
import { useInvoicePayments, useReceipt } from "@/lib/hooks/use-fees";

const METHOD_LABEL: Record<string, string> = { cash: "Cash", bkash: "bKash", nagad: "Nagad", sslcommerz: "Card / Net banking" };

/** Lists an invoice's payments and shows a printable receipt for the chosen one. */
export function PaymentsDialog({ invoiceId, title, onClose }: { invoiceId: string | null; title: string; onClose: () => void }) {
  const payments = useInvoicePayments(invoiceId);
  const [paymentId, setPaymentId] = React.useState<string | null>(null);
  const receipt = useReceipt(paymentId);
  React.useEffect(() => setPaymentId(null), [invoiceId]);

  return (
    <FormModal open={Boolean(invoiceId)} onOpenChange={(o) => !o && onClose()} title={title}>
      {payments.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {payments.data && payments.data.items.length === 0 && <p className="text-sm text-slate-500">No payments recorded yet.</p>}
      {!paymentId && (
        <ul className="flex flex-col divide-y divide-slate-100">
          {payments.data?.items.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>
                <span className="font-medium">{formatTaka(p.amount)}</span> · {METHOD_LABEL[p.method] ?? p.method} · {new Date(p.paidAt).toLocaleDateString()}
              </span>
              <Button size="sm" variant="outline" onClick={() => setPaymentId(p.id)}>Receipt</Button>
            </li>
          ))}
        </ul>
      )}
      {paymentId && receipt.data && (
        <div>
          <div id="print-receipt" className="rounded-lg border border-slate-200 p-4 text-sm">
            <h3 className="text-base font-semibold">{receipt.data.receipt.schoolName}</h3>
            <p className="text-slate-500">Payment receipt #{receipt.data.receipt.receiptNo}</p>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-slate-500">Student</dt><dd>{receipt.data.receipt.studentName}{receipt.data.receipt.studentCode ? ` (${receipt.data.receipt.studentCode})` : ""}</dd>
              <dt className="text-slate-500">For</dt><dd>{receipt.data.receipt.feeName} · {receipt.data.receipt.term}</dd>
              <dt className="text-slate-500">Amount</dt><dd className="font-semibold">{formatTaka(receipt.data.receipt.amount)}</dd>
              <dt className="text-slate-500">Method</dt><dd>{METHOD_LABEL[receipt.data.receipt.method] ?? receipt.data.receipt.method}</dd>
              {receipt.data.receipt.transactionRef && (<><dt className="text-slate-500">Reference</dt><dd>{receipt.data.receipt.transactionRef}</dd></>)}
              <dt className="text-slate-500">Paid on</dt><dd>{new Date(receipt.data.receipt.paidAt).toLocaleString()}</dd>
              <dt className="text-slate-500">Balance</dt><dd>{formatTaka(receipt.data.receipt.balanceAfter)}</dd>
            </dl>
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => window.print()}>Print</Button>
            <Button size="sm" variant="outline" onClick={() => setPaymentId(null)}>Back</Button>
          </div>
        </div>
      )}
      {paymentId && receipt.isError && <p className="text-sm text-red-600">Could not load the receipt.</p>}
    </FormModal>
  );
}
