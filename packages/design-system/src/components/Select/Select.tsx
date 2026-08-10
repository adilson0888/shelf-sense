import * as React from "react";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  /** Field label, rendered above the control. */
  label?: string;
  /** Options to render. */
  options: SelectOption[];
  /** Placeholder shown as a disabled first option when no value is selected. */
  placeholder?: string;
}

/** Dropdown select — use for bounded choices like category, aisle, or warehouse. */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, placeholder, id, ...props }, ref) => {
    const generatedId = React.useId();
    const selectId = id ?? generatedId;

    return (
      <div className="flex flex-col gap-xs">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-ink-primary">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "h-10 rounded-md border border-border-strong bg-surface-0 px-sm text-sm text-ink-primary",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            className,
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  },
);
Select.displayName = "Select";
