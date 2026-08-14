import * as React from "react";
import { cn } from "@/lib/cn";

export type FooterProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * The bottom brand bar for a top-level page (Inventory, Product List,
 * Settings) — just the "shelf·sense" wordmark, right-aligned. Built from
 * real text on theme tokens (`text-ink-primary`/`text-brand-600`), not an
 * image asset — a `lockup-ledger.svg`-shaped asset bakes a fixed dark fill
 * that goes unreadable on a dark surface, the same reason AppShell's own
 * nav-drawer header avoids it (see specs/Brand.md, specs/Menu.md).
 *
 * Page-level chrome only — never inside a `Modal` or a chromeless
 * full-screen edit overlay (Product Edit, Stock Edit) that already uses its
 * own footer slot for Save/Cancel.
 */
export function Footer({ className, ...props }: FooterProps) {
  return (
    <div
      className={cn("flex h-16 flex-shrink-0 items-center justify-end border-t border-border bg-surface-0 px-md", className)}
      {...props}
    >
      <span className="flex items-baseline font-mono text-[17px] tracking-[-0.01em] text-ink-primary">
        <span className="font-semibold">shelf</span>
        <span className="mx-[3px] inline-block h-[5px] w-[5px] rounded-full bg-brand-600" aria-hidden="true" />
        <span className="font-medium text-brand-600">sense</span>
      </span>
    </div>
  );
}
