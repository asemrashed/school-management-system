"use client";

import * as React from "react";
import { ArrowUpDown } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/table";
import { LoadingSkeleton } from "./loading-skeleton";
import { EmptyState } from "./states";
import { ErrorState } from "./states";
import { cn } from "../lib/cn";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

/**
 * The ONLY table component for list/table views (component-registry.md).
 * Consumers pass already-fetched data (via TanStack Query hooks) — this
 * component owns rendering, sorting UI, and empty/loading/error states only.
 */
export function DataTable<T>({
  columns,
  data,
  keyField,
  isLoading,
  isError,
  onRetry,
  emptyTitle = "No records found",
  emptyDescription,
  sortKey,
  sortDirection,
  onSortChange,
  footer,
}: {
  columns: DataTableColumn<T>[];
  data: T[];
  keyField: (row: T) => string;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  sortKey?: string;
  sortDirection?: "asc" | "desc";
  onSortChange?: (key: string) => void;
  footer?: React.ReactNode;
}) {
  if (isLoading) return <LoadingSkeleton rows={6} />;
  if (isError) return <ErrorState onRetry={onRetry} />;
  if (data.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />;

  return (
    <div className="flex flex-col gap-3">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key} className={col.className}>
                {col.sortable && onSortChange ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-slate-700"
                    onClick={() => onSortChange(col.key)}
                  >
                    {col.header}
                    <ArrowUpDown
                      className={cn(
                        "h-3 w-3",
                        sortKey === col.key ? "text-brand-600" : "text-slate-300"
                      )}
                    />
                  </button>
                ) : (
                  col.header
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={keyField(row)}>
              {columns.map((col) => (
                <TableCell key={col.key} className={col.className}>
                  {col.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {footer}
    </div>
  );
}
