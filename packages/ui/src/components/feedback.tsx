import * as React from "react";
import { cn } from "../lib/cn";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-slate-200", className)}
      {...props}
    />
  );
}

export type ToastVariant = "default" | "success" | "error";

const toastVariantClasses: Record<ToastVariant, string> = {
  default: "border-slate-200 bg-white text-slate-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-800",
};

export function Toast({
  title,
  description,
  variant = "default",
}: {
  title: string;
  description?: string;
  variant?: ToastVariant;
}) {
  return (
    <div
      role="status"
      className={cn(
        "w-full max-w-sm rounded-lg border p-4 shadow-md",
        toastVariantClasses[variant]
      )}
    >
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-1 text-sm opacity-90">{description}</p>}
    </div>
  );
}
