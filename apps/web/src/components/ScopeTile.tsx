import { cn } from "shelf-sense-ds";

/**
 * Count-on-top, label-below filter tile — originally local to Inventory.tsx
 * (its scope tiles: All items / Attention / Low stock), extracted here once
 * Product List needed the identical shape for its own two filter-tile rows
 * (Type, Does it expire). Purely presentational; each caller supplies its
 * own active-state color via `activeClassName` since different tiles carry
 * different meanings (warning for Attention, info for Low stock, neutral
 * for a plain multi-way filter like Product List's).
 */
export function ScopeTile({
  active,
  count,
  label,
  activeClassName,
  hoverClassName,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  activeClassName: string;
  hoverClassName?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-[6px] rounded-lg border px-[12px] py-[10px] text-left",
        active ? activeClassName : cn("border-border bg-surface-1 text-ink-secondary", hoverClassName),
      )}
    >
      <span className="font-mono text-[22px] font-semibold leading-none">{count}</span>
      <span className="text-[11px] uppercase tracking-[0.04em] opacity-75">{label}</span>
    </button>
  );
}
