import { Badge, type BadgeVariant } from "@packages/ui";
import type { InvoiceStatus } from "@packages/shared-types";

const STATUS_VARIANT: Record<InvoiceStatus, BadgeVariant> = {
  paid: "success",
  partial: "warning",
  unpaid: "muted",
  overdue: "danger",
};

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  paid: "Paid",
  partial: "Partially paid",
  unpaid: "Unpaid",
  overdue: "Overdue",
};

/** Shared status badge (component-registry.md: FeeStatusBadge). */
export function FeeStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
