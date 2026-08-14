import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

export interface PopoverPosition {
  x: number;
  y: number;
}

export interface PopoverProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Whether the popover is visible. */
  open: boolean;
  /** Called on backdrop click or Escape — the caller owns `open` state. */
  onClose: () => void;
  /**
   * Fixed viewport coordinates for the menu's top-left corner — the caller
   * computes this (typically from the trigger button's own
   * `getBoundingClientRect()`), same division of responsibility as every
   * other positioned overlay in this design system. No auto-placement or
   * edge-collision logic here by design — keep it simple until a real
   * caller needs more.
   */
  position: PopoverPosition;
}

/**
 * A small anchored menu — the "⋯" row-actions pattern (Product List's
 * per-row Edit product / Edit stock menu). Renders into a portal like
 * {@link Modal}, dismisses on backdrop click or Escape. Compose with
 * {@link PopoverItem} for each option.
 */
export function Popover({ open, onClose, position, className, children, ...props }: PopoverProps) {
  React.useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <>
      {/* Same invisible full-viewport scrim approach as Modal, just without
          the dimming — this menu shouldn't visually darken the page behind it. */}
      <div className="fixed inset-0 z-[90]" onClick={onClose} />
      <div
        role="menu"
        className={cn(
          "fixed z-[91] flex min-w-[150px] flex-col gap-px rounded-md border border-border bg-surface-0 p-1 shadow-lg",
          className,
        )}
        style={{ left: position.x, top: position.y }}
        onClick={(e) => e.stopPropagation()}
        {...props}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}

export type PopoverItemProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export function PopoverItem({ className, type = "button", ...props }: PopoverItemProps) {
  return (
    <button
      type={type}
      role="menuitem"
      className={cn(
        "rounded-sm px-[10px] py-[9px] text-left text-[13px] font-medium text-ink-primary",
        "transition-colors duration-150 hover:bg-surface-2",
        className,
      )}
      {...props}
    />
  );
}
