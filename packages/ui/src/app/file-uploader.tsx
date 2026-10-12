"use client";

import * as React from "react";
import { UploadCloud, X } from "lucide-react";
import { cn } from "../lib/cn";

/**
 * Storage-provider agnostic: this component only collects a File and hands
 * it to `onUpload`, which callers wire to their API endpoint. The endpoint
 * decides Cloudinary/S3/R2 via the server-side storage provider factory
 * (packages/config) — this component never talks to a storage SDK directly.
 */
export function FileUploader({
  accept,
  maxSizeMb = 10,
  onUpload,
  label = "Click to upload or drag and drop",
}: {
  accept?: string;
  maxSizeMb?: number;
  onUpload: (file: File) => void | Promise<void>;
  label?: string;
}) {
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function handleFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`File exceeds ${maxSizeMb}MB limit.`);
      return;
    }
    setFileName(file.name);
    onUpload(file);
  }

  return (
    <div>
      <div
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-slate-300 p-6 text-center hover:border-brand-400"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFile(e.dataTransfer.files?.[0]);
        }}
      >
        <UploadCloud className="h-6 w-6 text-slate-400" />
        <p className="text-sm text-slate-500">{label}</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {fileName && (
        <div className="mt-2 flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <span className="truncate">{fileName}</span>
          <button type="button" onClick={() => setFileName(null)} aria-label="Remove file">
            <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
