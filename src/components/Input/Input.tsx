import * as React from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Field label, rendered above the control. */
  label?: string;
  /** Helper text shown below the control when there's no error. */
  hint?: string;
  /** Validation error message; also switches the control into an error state. */
  error?: string;
}

/** Text input for forms — item names, SKUs, quantities, search boxes. */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    return (
      <div className="flex flex-col gap-xs">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-ink-primary">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={error || hint ? `${inputId}-description` : undefined}
          className={cn(
            "h-10 rounded-md border border-border-strong bg-surface-0 px-sm text-sm text-ink-primary",
            "placeholder:text-ink-muted",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-danger focus-visible:ring-danger",
            className,
          )}
          {...props}
        />
        {(error || hint) && (
          <p
            id={`${inputId}-description`}
            className={cn("text-xs", error ? "text-danger" : "text-ink-muted")}
          >
            {error ?? hint}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";
