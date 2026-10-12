"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import { cn } from "../lib/cn";

export interface ComboboxOption {
  value: string;
  label: string;
  hint?: string;
}

export interface ComboboxProps {
  /** Selected option value, or "" for none. */
  value: string;
  /** Called with the chosen value and its full option (null when cleared). */
  onChange: (value: string, option: ComboboxOption | null) => void;
  /** Options to show for the current search text. */
  options: ComboboxOption[];
  /** Fires on every keystroke (debounce in the caller); use it to fetch. */
  onSearch?: (query: string) => void;
  isLoading?: boolean;
  /** Label to show for `value` when it is not (yet) present in `options`. */
  selectedLabel?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  /** Show a clear (x) button when a value is selected. */
  clearable?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
}

/**
 * Searchable single-select dropdown. It is presentational: the caller owns
 * fetching (see apps/web LookupCombobox) so the same control works for a
 * static list or a server search. Keyboard: type to filter, arrow keys to
 * move, Enter to pick, Escape to close.
 */
export function Combobox({
  value,
  onChange,
  options,
  onSearch,
  isLoading,
  selectedLabel,
  placeholder = "Select…",
  searchPlaceholder = "Type to search…",
  emptyText = "No matches",
  disabled,
  clearable,
  id,
  className,
  "aria-label": ariaLabel,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listId = React.useId();

  // Without a server search the control filters the options it was given.
  const visible = React.useMemo(() => {
    if (onSearch || !query) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q));
  }, [options, onSearch, query]);

  const selected = options.find((o) => o.value === value);
  const display = value ? selected?.label ?? selectedLabel ?? "" : "";

  React.useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  React.useEffect(() => {
    setActive(0);
  }, [visible.length, query]);

  function openList() {
    if (disabled) return;
    setOpen(true);
    setQuery("");
    onSearch?.("");
    // Focus after the input mounts.
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function pick(option: ComboboxOption) {
    onChange(option.value, option);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(visible.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = visible[active];
      if (option) pick(option);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        <span className={cn("truncate", !display && "text-slate-400")}>{display || placeholder}</span>
        <span className="flex items-center gap-1 text-slate-400">
          {clearable && value && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear selection"
              className="rounded p-0.5 hover:bg-slate-100 hover:text-slate-600"
              onClick={(e) => {
                e.stopPropagation();
                onChange("", null);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronsUpDown className="h-4 w-4" />
        </span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[12rem] rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                onSearch?.(e.target.value);
              }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={visible[active] ? `${listId}-${active}` : undefined}
              className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
            {isLoading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />}
          </div>
          <ul id={listId} role="listbox" className="max-h-56 overflow-auto py-1">
            {visible.length === 0 && !isLoading && <li className="px-3 py-2 text-sm text-slate-500">{emptyText}</li>}
            {visible.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={o.value === value}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault(); // keep focus; avoids blur-before-click
                  pick(o);
                }}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm",
                  i === active && "bg-brand-50"
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-slate-900">{o.label}</span>
                  {o.hint && <span className="block truncate text-xs text-slate-500">{o.hint}</span>}
                </span>
                {o.value === value && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
