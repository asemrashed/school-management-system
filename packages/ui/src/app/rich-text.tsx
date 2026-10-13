"use client";

import * as React from "react";
import { Bold, Italic, List, Link as LinkIcon } from "lucide-react";
import { cn } from "../lib/cn";

/**
 * Minimal contentEditable rich text editor for CMS pages + notices.
 *
 * IMPORTANT: this emits raw HTML via onChange. Per CLAUDE.md, that HTML
 * must be passed through DOMPurify on the CLIENT before preview render
 * AND again on the SERVER before it is written to the DB (see
 * cms-domain.md). This component does not sanitize — callers must.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start writing...",
  className,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  // The editor DOM is the source of truth while the user types. We must NOT
  // re-render it through dangerouslySetInnerHTML on every keystroke: React
  // rewrites innerHTML, the caret jumps to the start, and text is typed
  // backwards ("Hey" -> "yeH"). Only write to the DOM when the value was
  // changed from OUTSIDE (initial value, form reset, loading a draft).
  React.useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== value) el.innerHTML = value;
  }, [value]);

  function exec(command: string, arg?: string) {
    document.execCommand(command, false, arg);
    if (ref.current) onChange(ref.current.innerHTML);
  }

  return (
    <div className={cn("rounded-md border border-slate-300", className)}>
      <div className="flex items-center gap-1 border-b border-slate-200 p-2">
        <ToolbarButton onClick={() => exec("bold")} label="Bold">
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("italic")} label="Italic">
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("insertUnorderedList")} label="List">
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => {
            const url = window.prompt("Link URL");
            if (url) exec("createLink", url);
          }}
          label="Link"
        >
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        className="min-h-[160px] px-3 py-2 text-sm text-slate-800 focus:outline-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]"
        role="textbox"
        aria-multiline="true"
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        // Paste as plain text: stops Word/web styles and scripts-in-markup from sneaking into notices.
        onPaste={(e) => {
          e.preventDefault();
          document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
        }}
      />
    </div>
  );
}

function ToolbarButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
    >
      {children}
    </button>
  );
}
