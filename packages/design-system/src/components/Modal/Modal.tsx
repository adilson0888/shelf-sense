import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

export interface ModalProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Whether the modal is visible. */
  open: boolean;
  /** Called on backdrop click or Escape — the caller owns `open` state. */
  onClose: () => void;
  /** Accessible label for the dialog — pass the same text shown in ModalTitle. */
  "aria-label"?: string;
}

/**
 * A focused overlay for a single decision or short flow (choosing how to
 * add a product, confirming a destructive action) — not a full page.
 * Renders into a portal so it always sits above app content regardless of
 * where it's mounted. Compose with ModalHeader/ModalTitle/ModalBody/
 * ModalFooter — same shape and classes as {@link Card}'s compound parts.
 */
export function Modal({ open, onClose, className, children, ...props }: ModalProps) {
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
    // A fixed black scrim (not a design token) is deliberate — its job is
    // to dim whatever's behind it regardless of light/dark theme, not to
    // carry brand/semantic meaning the way foreground colors do.
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-md" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={cn("w-full max-w-sm rounded-lg bg-surface-0 shadow-lg", className)}
        onClick={(e) => e.stopPropagation()}
        {...props}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export type ModalHeaderProps = React.HTMLAttributes<HTMLDivElement>;

export function ModalHeader({ className, ...props }: ModalHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-sm border-b border-border px-md py-sm", className)} {...props} />
  );
}

export type ModalTitleProps = React.HTMLAttributes<HTMLHeadingElement>;

export function ModalTitle({ className, ...props }: ModalTitleProps) {
  return <h3 className={cn("text-sm font-semibold text-ink-primary", className)} {...props} />;
}

export type ModalBodyProps = React.HTMLAttributes<HTMLDivElement>;

export function ModalBody({ className, ...props }: ModalBodyProps) {
  return <div className={cn("px-md py-md", className)} {...props} />;
}

export type ModalFooterProps = React.HTMLAttributes<HTMLDivElement>;

export function ModalFooter({ className, ...props }: ModalFooterProps) {
  return (
    <div className={cn("flex items-center justify-end gap-sm border-t border-border px-md py-sm", className)} {...props} />
  );
}
