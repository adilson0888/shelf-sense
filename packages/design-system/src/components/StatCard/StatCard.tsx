import * as React from "react";
import { cn } from "@/lib/cn";
import { Card } from "../Card/Card";

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Metric label, e.g. "Total SKUs tracked". */
  label: string;
  /** Metric value, e.g. "2,481" or "94%". */
  value: React.ReactNode;
  /** Optional trend delta, e.g. "+3.2%" or "-12 units". */
  delta?: string;
  /** Direction the delta represents, controls its color. @default "neutral" */
  trend?: "up" | "down" | "neutral";
  /** Icon rendered top-right. */
  icon?: React.ReactNode;
}

const trendClasses: Record<NonNullable<StatCardProps["trend"]>, string> = {
  up: "text-success",
  down: "text-danger",
  neutral: "text-ink-muted",
};

/** Dashboard metric tile — the building block of the inventory overview screen. */
export function StatCard({ label, value, delta, trend = "neutral", icon, className, ...props }: StatCardProps) {
  return (
    <Card className={cn("px-md py-md", className)} {...props}>
      <div className="flex items-start justify-between gap-sm">
        <p className="text-sm text-ink-secondary">{label}</p>
        {icon && <div className="text-ink-muted">{icon}</div>}
      </div>
      <p className="mt-xs text-2xl font-semibold text-ink-primary">{value}</p>
      {delta && <p className={cn("mt-xs text-xs font-medium", trendClasses[trend])}>{delta}</p>}
    </Card>
  );
}
