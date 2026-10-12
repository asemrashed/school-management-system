"use client";

import * as React from "react";
import { Combobox, type ComboboxOption } from "@packages/ui";
import type { LookupKind } from "@packages/shared-types";
import { useDebounced, useLookup } from "@/lib/hooks/use-setup";

/**
 * A searchable dropdown backed by GET /lookup/:kind. Use it anywhere a
 * person must choose a teacher / student / class / section / subject / room,
 * so nobody ever has to type or paste an id.
 *
 * `filters` narrows the list (e.g. sections of one class); changing a filter
 * should usually also reset `value` in the parent — see the dependent
 * dropdowns in the assignment form.
 */
export function LookupCombobox({
  kind,
  value,
  onChange,
  filters,
  placeholder,
  clearable,
  disabled,
  id,
  initialLabel,
}: {
  kind: LookupKind;
  value: string;
  onChange: (value: string, option: ComboboxOption | null) => void;
  filters?: { classId?: string; sectionId?: string; shiftId?: string };
  placeholder?: string;
  clearable?: boolean;
  disabled?: boolean;
  id?: string;
  /** Label to show before the user has opened the list (edit forms). */
  initialLabel?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [picked, setPicked] = React.useState<ComboboxOption | null>(null);
  const debounced = useDebounced(query, 250);
  const lookup = useLookup(kind, debounced, filters ?? {}, !disabled);

  // Clear the remembered label when the parent resets the value.
  React.useEffect(() => {
    if (!value) setPicked(null);
  }, [value]);

  const options = lookup.data?.items ?? [];
  return (
    <Combobox
      id={id}
      value={value}
      options={options}
      onSearch={setQuery}
      isLoading={lookup.isFetching}
      selectedLabel={picked?.value === value ? picked.label : initialLabel}
      onChange={(v, option) => {
        setPicked(option);
        onChange(v, option);
      }}
      placeholder={placeholder ?? `Select ${kind.replace(/s$/, "")}…`}
      clearable={clearable}
      disabled={disabled}
    />
  );
}
