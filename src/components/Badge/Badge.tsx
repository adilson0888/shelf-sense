import * as React from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant = "neutral" | "success" | "warning" | "danger" | "info";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Visual tone. @default "neutral" */
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "bg-surface-2 text-ink-secondary",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  info: "bg-info-bg text-info",
};

/**
 * General-purpose label for tags, categories, counts, or SKU metadata
 * (e.g. "Frozen", "Aisle 4", "New"). For shelf-stock state specifically,
 * use {@link StatusBadge} instead — it has the fixed status vocabulary.
 */
export function Badge({ variant = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-sm py-[2px] text-xs font-medium",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
