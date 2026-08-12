import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { IconButton } from "../IconButton";

export interface NavDrawerItem {
  key: string;
  label: string;
  /** A text/emoji glyph or inline SVG — shelf-sense-ds has no icon-set dependency. */
  icon: React.ReactNode;
  active: boolean;
  onSelect: () => void;
}

export interface NavDrawerProps {
  /** Whether the drawer is open. */
  open: boolean;
  /** Called on scrim click, the close control, an item select, or Escape — caller owns `open` state. */
  onClose: () => void;
  /** Rendered at the top of the panel — brand mark, app name, etc. */
  header: React.ReactNode;
  /** Flat list of navigable sections — no grouping/nesting. */
  items: NavDrawerItem[];
  /** Rendered at the bottom of the panel below a divider (e.g. a theme toggle) — not a navigable item. */
  footer?: React.ReactNode;
  /** Accessible label for the dialog. @default "Navigation" */
  "aria-label"?: string;
}

/**
 * Overlay navigation drawer: scrim + sliding panel with a flat item list
 * and optional header/footer slots. Pairs with a hamburger {@link IconButton}
 * in the app's own top bar to open it — this component only owns the
 * drawer itself, not the trigger or the page chrome around it.
 *
 * Unlike {@link Modal}, this stays mounted while closed (translated
 * off-screen) so the open/close transition can animate — the scrim is a
 * real `<button>`, not a plain `onClick` div, specifically so it can be
 * taken out of tab order and hit-testing via `tabIndex`/`pointer-events`
 * while closed instead of just disappearing.
 */
export function NavDrawer({
  open,
  onClose,
  header,
  items,
  footer,
  "aria-label": ariaLabel = "Navigation",
}: NavDrawerProps) {
  React.useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return createPortal(
    <div className={cn("fixed inset-0 z-50", open ? "pointer-events-auto" : "pointer-events-none")}>
      <button
        aria-label="Close navigation"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={cn(
          "absolute inset-0 h-full w-full cursor-pointer border-none bg-black/50 p-0",
          "transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={cn(
          "absolute inset-y-0 left-0 flex w-[288px] max-w-[86vw] flex-col",
          "border-r border-border bg-surface-0 shadow-lg",
          "transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between gap-sm border-b border-border px-md py-md">
          {header}
          <IconButton icon="✕" aria-label="Close navigation" size="sm" onClick={onClose} />
        </div>
        <nav className="flex flex-1 flex-col gap-[2px] overflow-y-auto p-sm">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={item.onSelect}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "flex items-center gap-sm rounded-full px-md py-sm text-left text-[15px]",
                item.active
                  ? "bg-info-bg font-bold text-info"
                  : "font-medium text-ink-secondary hover:bg-surface-2",
              )}
            >
              <span className="w-[22px] flex-shrink-0 text-center text-lg" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </nav>
        {footer && <div className="flex-shrink-0 border-t border-border px-md py-md">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
