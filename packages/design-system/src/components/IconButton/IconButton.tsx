import * as React from "react";
import { cn } from "@/lib/cn";

export type IconButtonSize = "sm" | "md" | "lg";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** The glyph/icon to render — a text/emoji glyph or an inline SVG. */
  icon: React.ReactNode;
  /** @default "md" */
  size?: IconButtonSize;
  /** Required — an icon-only button has no other accessible name. */
  "aria-label": string;
}

const sizeClasses: Record<IconButtonSize, string> = {
  sm: "h-9 w-9 text-[15px]",
  md: "h-10 w-10 text-[17px]",
  lg: "h-11 w-11 text-[19px]",
};

/**
 * Circular icon-only button — the hamburger trigger, drawer close control,
 * and theme toggle all use this. Transparent by default, `surface-2` on
 * hover, same focus ring as {@link Button}.
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, icon, size = "md", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex flex-shrink-0 items-center justify-center rounded-full bg-transparent text-ink-primary",
          "transition-colors duration-150 hover:bg-surface-2",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        <span aria-hidden="true">{icon}</span>
      </button>
    );
  },
);
IconButton.displayName = "IconButton";
