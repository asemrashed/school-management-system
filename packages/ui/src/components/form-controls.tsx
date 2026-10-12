import * as React from "react";
import { cn } from "../lib/cn";

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("text-sm font-medium text-slate-700", className)}
      {...props}
    />
  )
);
Label.displayName = "Label";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export const Checkbox = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="checkbox"
    className={cn(
      "h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500",
      className
    )}
    {...props}
  />
));
Checkbox.displayName = "Checkbox";

export const Switch = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <label className="relative inline-flex cursor-pointer items-center">
    <input ref={ref} type="checkbox" className="peer sr-only" {...props} />
    <div
      className={cn(
        "h-6 w-11 rounded-full bg-slate-300 transition-colors peer-checked:bg-brand-600",
        "after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full",
        "after:bg-white after:transition-transform peer-checked:after:translate-x-5",
        className
      )}
    />
  </label>
));
Switch.displayName = "Switch";
