"use client";

import * as React from "react";
import { Select } from "@packages/ui";
import { useMyChildren } from "@/lib/hooks/use-performance";

/** Parents with several children pick whose data to see; a student just gets themselves. */
export function useSelectedChild() {
  const children = useMyChildren();
  const [selected, setSelected] = React.useState("");
  const items = children.data?.items ?? [];
  const studentId = selected || items[0]?.studentId;
  return { items, studentId, setSelected, isLoading: children.isLoading };
}

export function ChildPicker({ items, value, onChange }: { items: { studentId: string; name: string; className: string | null; sectionName: string | null }[]; value: string | undefined; onChange: (id: string) => void }) {
  if (items.length <= 1) {
    return items[0] ? <p className="mb-4 text-sm text-slate-600">Showing <strong>{items[0].name}</strong>{items[0].className ? ` · ${items[0].className} ${items[0].sectionName ?? ""}` : ""}</p> : null;
  }
  return (
    <div className="mb-4 flex items-center gap-3">
      <label htmlFor="child-picker" className="text-sm font-medium text-slate-700">Child</label>
      <Select id="child-picker" className="w-64" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        {items.map((c) => <option key={c.studentId} value={c.studentId}>{c.name}{c.className ? ` — ${c.className} ${c.sectionName ?? ""}` : ""}</option>)}
      </Select>
    </div>
  );
}
