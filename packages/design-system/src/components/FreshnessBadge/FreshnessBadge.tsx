import * as React from "react";
import { cn } from "@/lib/cn";

export type FreshnessStatus = "fresh" | "expiring-soon" | "expired" | "no-expiration";

export interface FreshnessBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** How close to spoiling the product/batch is. */
  status: FreshnessStatus;
  /** Overrides the default label for the status. */
  label?: string;
}

const statusConfig: Record<FreshnessStatus, { label: string; text: string; bg: string; dot: string }> = {
  fresh: {
    label: "Fresh",
    text: "text-freshness-fresh",
    bg: "bg-freshness-fresh-bg",
    dot: "bg-freshness-fresh",
  },
  "expiring-soon": {
    label: "Expiring soon",
    text: "text-freshness-expiring-soon",
    bg: "bg-freshness-expiring-soon-bg",
    dot: "bg-freshness-expiring-soon",
  },
  expired: {
    label: "Expired",
    text: "text-freshness-expired",
    bg: "bg-freshness-expired-bg",
    dot: "bg-freshness-expired",
  },
  "no-expiration": {
    label: "No expiration",
    text: "text-freshness-no-expiration",
    bg: "bg-freshness-no-expiration-bg",
    dot: "bg-freshness-no-expiration",
  },
};

/**
 * The other controlled status vocabulary of ShelfSense, alongside
 * {@link StatusBadge}'s stock states: how close a product is to spoiling,
 * derived from the soonest-expiring batch. Prefer this over a generic
 * {@link Badge} whenever the value is a freshness state — it carries the
 * fixed semantic color mapping for that state.
 */
export function FreshnessBadge({ status, label, className, ...props }: FreshnessBadgeProps) {
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
