import * as React from "react";
import { cn } from "../lib/cn";

export type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const variantClasses: Record<ButtonVariant, string> = {
  default: "bg-brand-600 text-white hover:bg-brand-700",
  secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
  outline: "border border-slate-300 bg-white hover:bg-slate-50 text-slate-900",
  ghost: "hover:bg-slate-100 text-slate-700",
  destructive: "bg-red-600 text-white hover:bg-red-700",
};

// min-h (not h): a long label wraps and the button grows instead of clipping
// or running out of its padding. `sm` is 36px on touch screens (comfortable
// tap target) and 32px from the `sm` breakpoint up.
const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 py-1.5 text-sm sm:min-h-8",
  md: "min-h-10 px-4 py-2 text-sm",
  lg: "min-h-11 px-5 py-2.5 text-base sm:px-6",
  icon: "h-10 w-10",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Render the button styles onto its single child instead of a <button>
   * (e.g. a Next <Link> or <a href>). Use this instead of nesting a Button
   * inside a link: a <button> inside an <a> is invalid HTML, gets two tab
   * stops, and its padding/width never match the link's click area.
   *
   *   <Button asChild><Link href="/login">Sign in</Link></Button>
   */
  asChild?: boolean;
}

/** The class string behind a Button, for the rare element that cannot be wrapped. */
export function buttonClasses(variant: ButtonVariant = "default", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex max-w-full items-center justify-center gap-2 whitespace-normal rounded-md text-center font-medium leading-snug transition-colors",
    "disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
    variantClasses[variant],
    sizeClasses[size],
    className
  );
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", asChild = false, children, ...props }, ref) => {
    const classes = buttonClasses(variant, size, className);
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{ className?: string }>;
      return React.cloneElement(child, {
        ...(props as object),
        className: cn(classes, child.props.className),
      } as Record<string, unknown>);
    }
    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
