import * as React from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. @default "primary" */
  variant?: ButtonVariant;
  /** Size. @default "md" */
  size?: ButtonSize;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
  /** Icon rendered before the label. */
  leadingIcon?: React.ReactNode;
  /** Icon rendered after the label. */
  trailingIcon?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-ink-inverse hover:bg-brand-700 active:bg-brand-800",
  secondary: "bg-surface-2 text-ink-primary hover:bg-surface-3 active:bg-surface-3",
  outline: "border border-border-strong bg-transparent text-ink-primary hover:bg-surface-2",
  ghost: "bg-transparent text-ink-primary hover:bg-surface-2",
  danger: "bg-danger text-ink-inverse hover:opacity-90 active:opacity-80",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-sm text-sm gap-xs",
  md: "h-10 px-md text-sm gap-sm",
  lg: "h-12 px-lg text-base gap-sm",
};

/**
 * Primary interactive control for actions like "Add stock", "Confirm shipment",
 * or "Delete item". Use `variant="danger"` for destructive/irreversible actions.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      leadingIcon,
      trailingIcon,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium",
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {loading ? (
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        ) : (
          leadingIcon
        )}
        {children}
        {!loading && trailingIcon}
      </button>
    );
  },
);
Button.displayName = "Button";
