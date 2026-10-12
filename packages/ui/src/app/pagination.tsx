import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../components/button";

/** Offset-based pagination controls (small/admin lists). */
export function OffsetPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between text-sm text-slate-600">
      <span>
        Page {page} of {Math.max(totalPages, 1)}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/** Cursor-based pagination controls (large lists). */
export function CursorPagination({
  hasMore,
  loading,
  onLoadMore,
}: {
  hasMore: boolean;
  loading?: boolean;
  onLoadMore: () => void;
}) {
  if (!hasMore) return null;
  return (
    <div className="flex justify-center">
      <Button variant="outline" size="sm" onClick={onLoadMore} disabled={loading}>
        {loading ? "Loading..." : "Load more"}
      </Button>
    </div>
  );
}
