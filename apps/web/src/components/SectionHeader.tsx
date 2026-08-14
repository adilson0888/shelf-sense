import { cn } from "shelf-sense-ds";

/**
 * A collapsible section header — chevron rotates, matches the approved
 * Claude Design prototype (templates/settings/Settings.dc.html). Originally
 * local to Settings.tsx; extracted here once Product List needed the same
 * collapsible-section pattern for its search/filters block.
 */
export function SectionHeader({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex items-center justify-between gap-sm bg-transparent p-0 text-left"
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</span>
      <span className={cn("text-xs text-ink-muted transition-transform", open ? "rotate-0" : "-rotate-90")}>▾</span>
    </button>
  );
}
