import * as React from "react";
import { cn } from "@/lib/cn";

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

/** Generic surface container — the base for panels, list rows, and dashboard tiles. */
export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface-0 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export type CardHeaderProps = React.HTMLAttributes<HTMLDivElement>;

export function CardHeader({ className, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn("flex items-center justify-between gap-sm border-b border-border px-md py-sm", className)}
      {...props}
    />
  );
}

export type CardTitleProps = React.HTMLAttributes<HTMLHeadingElement>;

export function CardTitle({ className, ...props }: CardTitleProps) {
  return <h3 className={cn("text-sm font-semibold text-ink-primary", className)} {...props} />;
}

export type CardBodyProps = React.HTMLAttributes<HTMLDivElement>;

export function CardBody({ className, ...props }: CardBodyProps) {
  return <div className={cn("px-md py-md", className)} {...props} />;
}

export type CardFooterProps = React.HTMLAttributes<HTMLDivElement>;

export function CardFooter({ className, ...props }: CardFooterProps) {
  return (
    <div
      className={cn("flex items-center justify-end gap-sm border-t border-border px-md py-sm", className)}
      {...props}
    />
  );
}
