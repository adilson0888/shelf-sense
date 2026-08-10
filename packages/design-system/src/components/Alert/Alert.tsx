import * as React from "react";
import { cn } from "@/lib/cn";

export type AlertVariant = "success" | "warning" | "danger" | "info";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Tone of the alert. @default "info" */
  variant?: AlertVariant;
  /** Short bold heading. */
  title: string;
  /** Optional icon; falls back to a filled dot per variant. */
  icon?: React.ReactNode;
}

const variantClasses: Record<AlertVariant, string> = {
  success: "border-transparent bg-success-bg text-success",
  warning: "border-transparent bg-warning-bg text-warning",
  danger: "border-transparent bg-danger-bg text-danger",
  info: "border-transparent bg-info-bg text-info",
};

/**
 * Inline banner for page/section-level messages — e.g. "12 shelves are below
 * threshold" or "Shipment #4021 delayed". For a single stock state on a row
 * or card, prefer {@link StatusBadge}.
 */
export function Alert({ variant = "info", title, icon, className, children, ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex gap-sm rounded-md border px-md py-sm text-sm",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {icon ?? <span className="mt-[3px] h-2 w-2 shrink-0 rounded-full bg-current" aria-hidden="true" />}
      <div className="flex flex-col gap-xs">
        <p className="font-semibold">{title}</p>
        {children && <div className="text-ink-secondary">{children}</div>}
      </div>
    </div>
  );
}
