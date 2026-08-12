// Settings only needs to exist as a Menu destination for this pass — real
// content (e.g. the language picker in i18n.md) is each owning spec's
// concern, not Menu's. See Menu.md's Out of scope section.
export function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col gap-md p-md">
      <div className="rounded-lg border border-dashed border-border-strong p-md text-[13px] leading-[1.55] text-ink-muted">
        Settings doesn't have real content yet — this screen exists so Menu has a second destination to navigate
        to and mark as current.
      </div>
    </div>
  );
}
