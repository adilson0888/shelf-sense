import { useEffect, useRef, useState } from "react";
import { Alert, Button, Input, Select, Switch, cn } from "shelf-sense-ds";
import { ApiError, type PreferencesResponse, type UpdatePreferencesPayload } from "../lib/api";
import { usePreferencesStore } from "../lib/preferencesStore";

const SAVED_MESSAGE_DELAY_MS = 2600;

const EYEBROW_CLASS = "text-xs font-semibold uppercase tracking-wide text-ink-muted";

const LANGUAGE_OPTIONS = [
  { value: "en-US", label: "English (US)" },
  { value: "pt-BR", label: "Português do Brasil" },
];

interface SettingsFormState {
  aiApiBaseUrl: string;
  aiModel: string;
  defaultMinimalQuantity: string;
  defaultFreshnessThresholdDays: string;
  defaultDoesExpire: boolean;
  language: "en-US" | "pt-BR";
}

function toFormState(p: PreferencesResponse): SettingsFormState {
  return {
    aiApiBaseUrl: p.ai_api_base_url ?? "",
    aiModel: p.ai_model ?? "",
    defaultMinimalQuantity: String(p.default_minimal_quantity),
    defaultFreshnessThresholdDays: String(p.default_freshness_threshold_days),
    defaultDoesExpire: p.default_does_expire,
    language: p.language,
  };
}

/** Strict "0 or greater whole number" — same hard-validation bar Product Add.md's own fields use. */
function parseNonNegativeInt(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  return Number.parseInt(value, 10);
}

/** A collapsible section header — chevron rotates, matches the approved Claude Design prototype (templates/settings/Settings.dc.html). */
function SectionHeader({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex items-center justify-between gap-sm bg-transparent p-0 text-left"
    >
      <span className={EYEBROW_CLASS}>{label}</span>
      <span className={cn("text-xs text-ink-muted transition-transform", open ? "rotate-0" : "-rotate-90")}>▾</span>
    </button>
  );
}

/**
 * Real content for the Settings page — see specs/Settings.md and the
 * approved Claude Design prototype (templates/settings/Settings.dc.html).
 * Replaces the placeholder Menu.md left here; /settings itself was already
 * routed and reachable from the nav drawer.
 *
 * Each of the three categories is collapsible (AI Settings open by default,
 * the other two closed) and has its own Save button — all three submit the
 * same full current form via PATCH /preferences (full-replace semantics,
 * see lib/api.ts), just positioned per-section rather than once at the
 * bottom, so saving one category doesn't require scrolling past the others.
 */
export function SettingsPage() {
  const { preferences, loading, error, refetch, save } = usePreferencesStore();

  const [form, setForm] = useState<SettingsFormState>(() => toFormState(preferences));
  // Resets only when `preferences` itself changes — a successful GET or a
  // successful save, exactly the two moments the form should reset. A
  // failed save leaves `preferences` untouched, so the form stays as typed.
  useEffect(() => setForm(toFormState(preferences)), [preferences]);

  const [aiOpen, setAiOpen] = useState(true);
  const [defaultsOpen, setDefaultsOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);

  // API key field: an always-blank "new key" draft, mutually exclusive with
  // "clear saved key" — typing clears the pending-clear flag, and the saved-
  // key hint/clear row hides while a new value is being typed.
  const [newApiKey, setNewApiKey] = useState("");
  const [pendingClearKey, setPendingClearKey] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const savedTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    [],
  );

  function setField<K extends keyof SettingsFormState>(key: K, value: SettingsFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleApiKeyChange(value: string) {
    setNewApiKey(value);
    if (value) setPendingClearKey(false);
  }
  function handleClearKey() {
    setNewApiKey("");
    setPendingClearKey(true);
  }

  const minQty = parseNonNegativeInt(form.defaultMinimalQuantity);
  const freshDays = parseNonNegativeInt(form.defaultFreshnessThresholdDays);
  const canSave = minQty !== null && freshDays !== null && !saving;

  async function handleSave() {
    if (minQty === null || freshDays === null) return;
    setSaving(true);
    setSaveError(null);
    const payload: UpdatePreferencesPayload = {
      ai_api_base_url: form.aiApiBaseUrl.trim() ? form.aiApiBaseUrl.trim() : null,
      ai_model: form.aiModel.trim() ? form.aiModel.trim() : null,
      default_minimal_quantity: minQty,
      default_freshness_threshold_days: freshDays,
      default_does_expire: form.defaultDoesExpire,
      language: form.language,
      ...(newApiKey ? { ai_api_key: newApiKey } : pendingClearKey ? { ai_api_key: null } : {}),
    };
    try {
      await save(payload);
      setNewApiKey("");
      setPendingClearKey(false);
      setJustSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => setJustSaved(false), SAVED_MESSAGE_DELAY_MS);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Couldn't save your settings. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-[64px] text-[13px] text-ink-muted">
        Loading your settings…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-md px-[28px] py-[64px] text-center">
        <Alert variant="danger" title="Couldn't load your settings">
          {error}
        </Alert>
        <Button variant="outline" onClick={refetch}>
          Try again
        </Button>
      </div>
    );
  }

  // Hides while a new value is being typed — typing and "clear" are mutually
  // exclusive, and there's nothing saved-key-related to show mid-edit.
  const showSavedKeyRow = preferences.ai_api_key_set && !pendingClearKey && !newApiKey;

  return (
    <div className="flex flex-1 flex-col gap-lg overflow-y-auto p-md pb-[24px]">
      {justSaved && <Alert variant="success" title="Saved" />}
      {saveError && (
        <Alert variant="danger" title="Couldn't save">
          {saveError}
        </Alert>
      )}

      <section className="flex flex-col gap-md">
        <SectionHeader label="AI Settings" open={aiOpen} onToggle={() => setAiOpen((v) => !v)} />
        {aiOpen && (
          <>
            <Input
              label="API base URL"
              placeholder="https://api.openai.com/v1"
              value={form.aiApiBaseUrl}
              onChange={(e) => setField("aiApiBaseUrl", e.target.value)}
            />
            <div className="flex flex-col gap-xs">
              <Input label="API key" type="password" value={newApiKey} onChange={(e) => handleApiKeyChange(e.target.value)} />
              {showSavedKeyRow && (
                <div className="flex items-center gap-sm">
                  <span className="text-xs text-ink-muted">A key is saved ({preferences.ai_api_key_hint}).</span>
                  <button type="button" onClick={handleClearKey} className="bg-transparent p-0 text-xs font-semibold text-brand-600 underline">
                    Clear saved key
                  </button>
                </div>
              )}
              {pendingClearKey && <p className="text-xs text-ink-muted">The saved key will be cleared when you save.</p>}
            </div>
            <Input
              label="Model"
              placeholder="e.g. gpt-4o-mini"
              value={form.aiModel}
              onChange={(e) => setField("aiModel", e.target.value)}
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={handleSave} disabled={!canSave}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </>
        )}
      </section>

      <div className="flex flex-col gap-md border-t border-border pt-lg">
        <SectionHeader label="Default Options" open={defaultsOpen} onToggle={() => setDefaultsOpen((v) => !v)} />
        {defaultsOpen && (
          <>
            <Input
              label="Default minimal quantity"
              type="number"
              min={0}
              value={form.defaultMinimalQuantity}
              onChange={(e) => setField("defaultMinimalQuantity", e.target.value)}
              error={minQty === null ? "Enter a whole number, 0 or greater." : undefined}
            />
            <Switch
              label="Products expire by default"
              checked={form.defaultDoesExpire}
              onCheckedChange={(checked) => setField("defaultDoesExpire", checked)}
            />
            {form.defaultDoesExpire && (
              <Input
                label="Default freshness threshold (days)"
                type="number"
                min={0}
                value={form.defaultFreshnessThresholdDays}
                onChange={(e) => setField("defaultFreshnessThresholdDays", e.target.value)}
                error={freshDays === null ? "Enter a whole number, 0 or greater." : undefined}
              />
            )}
            <div className="flex justify-end">
              <Button size="sm" onClick={handleSave} disabled={!canSave}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col gap-md border-t border-border pt-lg">
        <SectionHeader label="User Preferences" open={prefsOpen} onToggle={() => setPrefsOpen((v) => !v)} />
        {prefsOpen && (
          <>
            <Select
              label="Language"
              options={LANGUAGE_OPTIONS}
              value={form.language}
              onChange={(e) => setField("language", e.target.value as SettingsFormState["language"])}
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={handleSave} disabled={!canSave}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
