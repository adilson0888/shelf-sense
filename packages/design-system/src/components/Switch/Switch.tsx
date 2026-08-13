import { cn } from "@/lib/cn";

export interface SwitchProps {
  /** Field label, rendered to the left of the control. */
  label?: string;
  /** Current on/off value. */
  checked: boolean;
  /** Called with the new value when either segment is clicked. */
  onCheckedChange: (checked: boolean) => void;
  /** Segment labels. */
  onLabel?: string;
  offLabel?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

/**
 * Binary on/off toggle, styled as a two-segment pill — use for a single
 * yes/no setting (e.g. "does it expire?"), where Select's multi-option
 * affordance would be misleading for a two-state choice.
 *
 * Visual language matches Inventory's Sort control exactly (SortButton in
 * apps/web/src/pages/Inventory.tsx): a rounded-full bg-surface-2 track
 * holding two segments, the active one raised. Unlike Sort — which stays
 * neutral (bg-surface-0) because it's just a view preference — the active
 * segment here uses bg-brand-600/text-ink-inverse, the same color
 * Button's "primary" variant uses, because a yes/no *value* is a real
 * choice worth the brand's affirmative color, not merely a display filter.
 *
 * Blue was considered and rejected: this design system reserves blue for
 * the "info" / "stock-incoming" semantic slot (--ss-info /
 * --ss-stock-incoming — see tokens.css), so using it here would borrow a
 * meaning ("info", "incoming stock") unrelated to this control. Brand teal
 * is this system's only "this is the affirmative/primary choice" color.
 */
export function Switch({
  label,
  checked,
  onCheckedChange,
  onLabel = "Yes",
  offLabel = "No",
  disabled,
  className,
  id,
}: SwitchProps) {
  return (
    <div className={cn("flex items-center justify-between gap-md", className)} id={id}>
      {label && <span className="text-sm font-medium text-ink-primary">{label}</span>}
      <div role="group" aria-label={label} className="flex gap-[2px] rounded-full bg-surface-2 p-[2px]">
        <SwitchSegment active={checked} disabled={disabled} onClick={() => onCheckedChange(true)} label={onLabel} />
        <SwitchSegment active={!checked} disabled={disabled} onClick={() => onCheckedChange(false)} label={offLabel} />
      </div>
    </div>
  );
}

function SwitchSegment({
  active,
  disabled,
  onClick,
  label,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-full border-none px-[11px] py-[5px] text-[12px] font-semibold transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        active ? "bg-brand-600 text-ink-inverse shadow-sm" : "bg-transparent text-ink-muted",
      )}
    >
      {label}
    </button>
  );
}
