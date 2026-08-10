import * as React from "react";
import { cn } from "@/lib/cn";

export type StockStatus = "in-stock" | "low" | "out" | "incoming";

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Which shelf-stock state this badge represents. */
  status: StockStatus;
  /** Overrides the default label for the status. */
  label?: string;
}

const statusConfig: Record<StockStatus, { label: string; text: string; bg: string; dot: string }> = {
  "in-stock": {
    label: "In stock",
    text: "text-stock-in-stock",
    bg: "bg-stock-in-stock-bg",
    dot: "bg-stock-in-stock",
  },
  low: {
    label: "Low stock",
    text: "text-stock-low",
    bg: "bg-stock-low-bg",
    dot: "bg-stock-low",
  },
  out: {
    label: "Out of stock",
    text: "text-stock-out",
    bg: "bg-stock-out-bg",
    dot: "bg-stock-out",
  },
  incoming: {
    label: "Incoming",
    text: "text-stock-incoming",
    bg: "bg-stock-incoming-bg",
    dot: "bg-stock-incoming",
  },
};

/**
 * The core status vocabulary of ShelfSense: shows whether a shelf/SKU is
 * in-stock, running low, out, or has incoming replenishment. Prefer this
 * over a generic {@link Badge} whenever the value is a stock state — it
 * carries the fixed semantic color mapping for that state.
 */
export function StatusBadge({ status, label, className, ...props }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-xs rounded-full px-sm py-[2px] text-xs font-medium",
        config.bg,
        config.text,
        className,
      )}
      {...props}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} aria-hidden="true" />
      {label ?? config.label}
    </span>
  );
}
