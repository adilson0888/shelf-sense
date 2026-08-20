import { useEffect, useRef, useState } from "react";
import { Alert, Button, Footer, IconButton, Input, Select, Switch } from "shelf-sense-ds";
import { useT } from "shelf-sense-i18n/react";
import { SectionHeader } from "../components/SectionHeader";
import { ApiError, type ComparisonSite, type PreferencesResponse, type UpdatePreferencesPayload } from "../lib/api";
import { useComparisonSitesStore } from "../lib/comparisonSitesStore";
import { usePreferencesStore } from "../lib/preferencesStore";

const SAVED_MESSAGE_DELAY_MS = 2600;

interface SettingsFormState {
  aiApiBaseUrl: string;
  aiModel: string;
  defaultMinimalQuantity: string;
  defaultMinimalPercentage: string;
  defaultFreshnessThresholdDays: string;
  defaultDoesExpire: boolean;
  language: "en-US" | "pt-BR";
}

// Seeds `language` from the active *resolved* locale (from useT(), i.e.
// what the app is actually rendering right now), not raw
// `preferences.language` — that matters before any preference row has
// ever been saved: `preferences.language` is just the server's bare
// column default then, not necessarily what the browser detected and the
// app is currently showing. Without this, saving an unrelated field (e.g.
// Default Options) before ever touching the language picker could
// silently persist the wrong language. See AppLocaleProvider.tsx.
function toFormState(p: PreferencesResponse, activeLocale: "en-US" | "pt-BR"): SettingsFormState {
  return {
    aiApiBaseUrl: p.ai_api_base_url ?? "",
    aiModel: p.ai_model ?? "",
    defaultMinimalQuantity: String(p.default_minimal_quantity),
    defaultMinimalPercentage: String(p.default_minimal_percentage),
    defaultFreshnessThresholdDays: String(p.default_freshness_threshold_days),
    defaultDoesExpire: p.default_does_expire,
    language: activeLocale,
  };
}

/** Strict "0 or greater whole number" — same hard-validation bar Product Add.md's own fields use. */
function parseNonNegativeInt(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  return Number.parseInt(value, 10);
}

/** Same as parseNonNegativeInt, additionally capped at 100 — specs/Relative Tracking.md's default_minimal_percentage. */
function parsePercent(value: string): number | null {
  const n = parseNonNegativeInt(value);
  return n === null || n > 100 ? null : n;
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
  // specs/Price comparison.md's Settings CRUD — each action hits the API
  // immediately (add/edit/remove), unlike the rest of this page's fields,
  // which only save on the section's own Save button.
  const {
    sites: comparisonSites,
    loading: sitesLoading,
    error: sitesError,
    refetch: refetchSites,
    addSite,
    editSite,
    removeSite,
  } = useComparisonSitesStore();
  const { t, locale } = useT();
  const languageOptions = [
    { value: "en-US", label: t("settings.languageOptions.enUS") },
    { value: "pt-BR", label: t("settings.languageOptions.ptBR") },
  ];

  const [form, setForm] = useState<SettingsFormState>(() => toFormState(preferences, locale));
  // Resets only when `preferences` itself changes — a successful GET or a
  // successful save, exactly the two moments the form should reset. A
  // failed save leaves `preferences` untouched, so the form stays as typed.
  useEffect(() => setForm(toFormState(preferences, locale)), [preferences, locale]);

  const [aiOpen, setAiOpen] = useState(true);
  const [defaultsOpen, setDefaultsOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [comparisonSitesOpen, setComparisonSitesOpen] = useState(false);

  // API key field: an always-blank "new key" draft, mutually exclusive with
  // "clear saved key" — typing clears the pending-clear flag, and the saved-
  // key hint/clear row hides while a new value is being typed.
  const [newApiKey, setNewApiKey] = useState("");
  const [pendingClearKey, setPendingClearKey] = useState(false);
  // specs/Barcode Scanner & Product info scrape.md — Tavily key, same shape as ai_api_key above.
  const [newTavilyKey, setNewTavilyKey] = useState("");
  const [pendingClearTavilyKey, setPendingClearTavilyKey] = useState(false);

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

  function handleTavilyKeyChange(value: string) {
    setNewTavilyKey(value);
    if (value) setPendingClearTavilyKey(false);
  }
  function handleClearTavilyKey() {
    setNewTavilyKey("");
    setPendingClearTavilyKey(true);
  }

  const minQty = parseNonNegativeInt(form.defaultMinimalQuantity);
  const minPercent = parsePercent(form.defaultMinimalPercentage);
  const freshDays = parseNonNegativeInt(form.defaultFreshnessThresholdDays);
  const canSave = minQty !== null && minPercent !== null && freshDays !== null && !saving;

  async function handleSave() {
    if (minQty === null || minPercent === null || freshDays === null) return;
    setSaving(true);
    setSaveError(null);
    const payload: UpdatePreferencesPayload = {
      ai_api_base_url: form.aiApiBaseUrl.trim() ? form.aiApiBaseUrl.trim() : null,
      ai_model: form.aiModel.trim() ? form.aiModel.trim() : null,
      default_minimal_quantity: minQty,
      default_minimal_percentage: minPercent,
      default_freshness_threshold_days: freshDays,
      default_does_expire: form.defaultDoesExpire,
      language: form.language,
      ...(newApiKey ? { ai_api_key: newApiKey } : pendingClearKey ? { ai_api_key: null } : {}),
      ...(newTavilyKey ? { tavily_api_key: newTavilyKey } : pendingClearTavilyKey ? { tavily_api_key: null } : {}),
    };
    try {
      await save(payload);
      setNewApiKey("");
      setPendingClearKey(false);
      setNewTavilyKey("");
      setPendingClearTavilyKey(false);
      setJustSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => setJustSaved(false), SAVED_MESSAGE_DELAY_MS);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : t("settings.saveErrorFallback"));
    } finally {
      setSaving(false);
    }
  }

  // --- Comparison sites: local UI state only (add/edit forms) — the list
  // itself lives in comparisonSitesStore, per specs/Price comparison.md.
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [siteDraftLabel, setSiteDraftLabel] = useState("");
  const [siteDraftDomain, setSiteDraftDomain] = useState("");
  const [addingSite, setAddingSite] = useState(false);
  const [newSiteLabel, setNewSiteLabel] = useState("");
  const [newSiteDomain, setNewSiteDomain] = useState("");
  const [siteActionBusy, setSiteActionBusy] = useState(false);
  const [siteActionError, setSiteActionError] = useState<string | null>(null);

  function startEditSite(site: ComparisonSite) {
    setEditingSiteId(site.id);
    setSiteDraftLabel(site.label);
    setSiteDraftDomain(site.domain);
    setSiteActionError(null);
  }
  function cancelEditSite() {
    setEditingSiteId(null);
  }
  async function saveEditSite() {
    if (!editingSiteId || !siteDraftLabel.trim() || !siteDraftDomain.trim()) return;
    setSiteActionBusy(true);
    setSiteActionError(null);
    try {
      await editSite(editingSiteId, { label: siteDraftLabel.trim(), domain: siteDraftDomain.trim() });
      setEditingSiteId(null);
    } catch (err) {
      setSiteActionError(err instanceof ApiError ? err.message : t("settings.comparisonSites.saveError"));
    } finally {
      setSiteActionBusy(false);
    }
  }
  async function handleRemoveSite(id: string) {
    setSiteActionBusy(true);
    setSiteActionError(null);
    try {
      await removeSite(id);
    } catch (err) {
      setSiteActionError(err instanceof ApiError ? err.message : t("settings.comparisonSites.saveError"));
    } finally {
      setSiteActionBusy(false);
    }
  }
  function toggleAddSite() {
    setAddingSite((v) => !v);
    setNewSiteLabel("");
    setNewSiteDomain("");
    setSiteActionError(null);
  }
  async function handleAddSite() {
    if (!newSiteLabel.trim() || !newSiteDomain.trim()) return;
    setSiteActionBusy(true);
    setSiteActionError(null);
    try {
      await addSite({ label: newSiteLabel.trim(), domain: newSiteDomain.trim() });
      setAddingSite(false);
      setNewSiteLabel("");
      setNewSiteDomain("");
    } catch (err) {
      setSiteActionError(err instanceof ApiError ? err.message : t("settings.comparisonSites.saveError"));
    } finally {
      setSiteActionBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-[64px] text-[13px] text-ink-muted">
        {t("settings.loading")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-md px-[28px] py-[64px] text-center">
        <Alert variant="danger" title={t("settings.loadError")}>
          {error}
        </Alert>
        <Button variant="outline" onClick={refetch}>
          {t("common.tryAgain")}
        </Button>
      </div>
    );
  }

  // Hides while a new value is being typed — typing and "clear" are mutually
  // exclusive, and there's nothing saved-key-related to show mid-edit.
  const showSavedKeyRow = preferences.ai_api_key_set && !pendingClearKey && !newApiKey;
  const showSavedTavilyKeyRow = preferences.tavily_api_key_set && !pendingClearTavilyKey && !newTavilyKey;
  // specs/Advanced Settings.md — only relevant when there's no user-owned
  // key (saved or mid-typing) to show instead: either the user's own key
  // is what's in effect, or the operator's env-var one is, never both
  // messages at once. preferences.ai_api_key_set (not showSavedKeyRow)
  // deliberately keeps this hidden during a pending clear too — the saved
  // key is still the one in effect until that clear is actually saved.
  const showAdminKeyHint = !preferences.ai_api_key_set && !newApiKey && preferences.env_defaults.ai_api_key_set;
  const showAdminTavilyKeyHint =
    !preferences.tavily_api_key_set && !newTavilyKey && preferences.env_defaults.tavily_api_key_set;
  const showAdminBaseUrlHint = !form.aiApiBaseUrl.trim() && preferences.env_defaults.ai_api_base_url;
  const showAdminModelHint = !form.aiModel.trim() && preferences.env_defaults.ai_model;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-lg overflow-y-auto p-md pb-[24px]">
        {justSaved && <Alert variant="success" title={t("settings.saved")} />}
        {saveError && (
          <Alert variant="danger" title={t("settings.saveError")}>
            {saveError}
          </Alert>
        )}

        <section className="flex flex-col gap-md">
          <SectionHeader label={t("settings.aiSettings.heading")} open={aiOpen} onToggle={() => setAiOpen((v) => !v)} />
          {aiOpen && (
            <>
              <div className="flex flex-col gap-xs">
                <Input
                  label={t("settings.aiSettings.baseUrlLabel")}
                  placeholder={t("settings.aiSettings.baseUrlPlaceholder")}
                  value={form.aiApiBaseUrl}
                  onChange={(e) => setField("aiApiBaseUrl", e.target.value)}
                />
                {showAdminBaseUrlHint && (
                  <p className="text-xs text-ink-muted">
                    {t("settings.aiSettings.usingAdminDefault", { value: preferences.env_defaults.ai_api_base_url ?? "" })}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-xs">
                <Input
                  label={t("settings.aiSettings.apiKeyLabel")}
                  type="password"
                  value={newApiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                />
                {showSavedKeyRow && (
                  <div className="flex items-center gap-sm">
                    <span className="text-xs text-ink-muted">
                      {t("settings.aiSettings.keySavedHint", { hint: preferences.ai_api_key_hint ?? "" })}
                    </span>
                    <button type="button" onClick={handleClearKey} className="bg-transparent p-0 text-xs font-semibold text-brand-600 underline">
                      {t("settings.aiSettings.clearSavedKey")}
                    </button>
                  </div>
                )}
                {showAdminKeyHint && <p className="text-xs text-ink-muted">{t("settings.aiSettings.providedByAdmin")}</p>}
                {pendingClearKey && <p className="text-xs text-ink-muted">{t("settings.aiSettings.keyWillBeCleared")}</p>}
              </div>
              <div className="flex flex-col gap-xs">
                <Input
                  label={t("settings.aiSettings.modelLabel")}
                  placeholder={t("settings.aiSettings.modelPlaceholder")}
                  value={form.aiModel}
                  onChange={(e) => setField("aiModel", e.target.value)}
                />
                {showAdminModelHint && (
                  <p className="text-xs text-ink-muted">
                    {t("settings.aiSettings.usingAdminDefault", { value: preferences.env_defaults.ai_model ?? "" })}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-xs">
                <Input
                  label={t("settings.aiSettings.tavilyApiKeyLabel")}
                  hint={t("settings.aiSettings.tavilyApiKeyHint")}
                  type="password"
                  value={newTavilyKey}
                  onChange={(e) => handleTavilyKeyChange(e.target.value)}
                />
                {showSavedTavilyKeyRow && (
                  <div className="flex items-center gap-sm">
                    <span className="text-xs text-ink-muted">
                      {t("settings.aiSettings.keySavedHint", { hint: preferences.tavily_api_key_hint ?? "" })}
                    </span>
                    <button
                      type="button"
                      onClick={handleClearTavilyKey}
                      className="bg-transparent p-0 text-xs font-semibold text-brand-600 underline"
                    >
                      {t("settings.aiSettings.clearSavedKey")}
                    </button>
                  </div>
                )}
                {showAdminTavilyKeyHint && <p className="text-xs text-ink-muted">{t("settings.aiSettings.providedByAdmin")}</p>}
                {pendingClearTavilyKey && <p className="text-xs text-ink-muted">{t("settings.aiSettings.keyWillBeCleared")}</p>}
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={handleSave} disabled={!canSave}>
                  {saving ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </>
          )}
        </section>

        <div className="flex flex-col gap-md border-t border-border pt-lg">
          <SectionHeader label={t("settings.defaultOptions.heading")} open={defaultsOpen} onToggle={() => setDefaultsOpen((v) => !v)} />
          {defaultsOpen && (
            <>
              <Input
                label={t("settings.defaultOptions.minQtyLabel")}
                type="number"
                min={0}
                value={form.defaultMinimalQuantity}
                onChange={(e) => setField("defaultMinimalQuantity", e.target.value)}
                error={minQty === null ? t("settings.defaultOptions.numberError") : undefined}
              />
              <Input
                label={t("settings.defaultOptions.minPercentLabel")}
                type="number"
                min={0}
                max={100}
                hint={t("settings.defaultOptions.minPercentHint")}
                value={form.defaultMinimalPercentage}
                onChange={(e) => setField("defaultMinimalPercentage", e.target.value)}
                error={minPercent === null ? t("settings.defaultOptions.percentError") : undefined}
              />
              <Switch
                label={t("settings.defaultOptions.expireByDefaultLabel")}
                onLabel={t("common.yes")}
                offLabel={t("common.no")}
                checked={form.defaultDoesExpire}
                onCheckedChange={(checked) => setField("defaultDoesExpire", checked)}
              />
              {form.defaultDoesExpire && (
                <Input
                  label={t("settings.defaultOptions.freshnessLabel")}
                  type="number"
                  min={0}
                  value={form.defaultFreshnessThresholdDays}
                  onChange={(e) => setField("defaultFreshnessThresholdDays", e.target.value)}
                  error={freshDays === null ? t("settings.defaultOptions.numberError") : undefined}
                />
              )}
              <div className="flex justify-end">
                <Button size="sm" onClick={handleSave} disabled={!canSave}>
                  {saving ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col gap-md border-t border-border pt-lg">
          <SectionHeader label={t("settings.userPreferences.heading")} open={prefsOpen} onToggle={() => setPrefsOpen((v) => !v)} />
          {prefsOpen && (
            <>
              <Select
                label={t("settings.userPreferences.languageLabel")}
                options={languageOptions}
                value={form.language}
                onChange={(e) => setField("language", e.target.value as SettingsFormState["language"])}
              />
              <div className="flex justify-end">
                <Button size="sm" onClick={handleSave} disabled={!canSave}>
                  {saving ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col gap-md border-t border-border pt-lg">
          <SectionHeader
            label={t("settings.comparisonSites.heading")}
            open={comparisonSitesOpen}
            onToggle={() => setComparisonSitesOpen((v) => !v)}
          />
          {comparisonSitesOpen && (
            <>
              <p className="text-xs text-ink-muted">{t("settings.comparisonSites.description")}</p>

              {sitesLoading && <p className="text-xs text-ink-muted">{t("settings.comparisonSites.loading")}</p>}
              {!sitesLoading && sitesError && (
                <Alert variant="danger" title={t("settings.comparisonSites.loadError")}>
                  {sitesError}
                  <div className="mt-sm">
                    <Button variant="outline" size="sm" onClick={refetchSites}>
                      {t("common.tryAgain")}
                    </Button>
                  </div>
                </Alert>
              )}

              {!sitesLoading && !sitesError && (
                <>
                  {siteActionError && <Alert variant="danger" title={t("settings.comparisonSites.saveError")}>{siteActionError}</Alert>}

                  {comparisonSites.length === 0 && !addingSite && (
                    <p className="text-xs text-ink-muted">{t("settings.comparisonSites.emptyHint")}</p>
                  )}

                  {comparisonSites.length > 0 && (
                    <div className="overflow-hidden rounded-lg border border-border bg-surface-0">
                      <div className="grid grid-cols-[1fr_1fr_36px] gap-sm bg-surface-2 px-md py-[9px] font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">
                        <span>{t("settings.comparisonSites.labelLabel")}</span>
                        <span>{t("settings.comparisonSites.domainLabel")}</span>
                        <span />
                      </div>
                      {comparisonSites.map((site) =>
                        editingSiteId === site.id ? (
                          <div key={site.id} className="flex flex-col gap-sm border-t border-border p-md">
                            <Input
                              autoFocus
                              label={t("settings.comparisonSites.labelLabel")}
                              value={siteDraftLabel}
                              onChange={(e) => setSiteDraftLabel(e.target.value)}
                            />
                            <Input
                              label={t("settings.comparisonSites.domainLabel")}
                              placeholder={t("settings.comparisonSites.domainPlaceholder")}
                              value={siteDraftDomain}
                              onChange={(e) => setSiteDraftDomain(e.target.value)}
                            />
                            <div className="flex justify-end gap-sm">
                              <Button type="button" variant="ghost" size="sm" onClick={cancelEditSite} disabled={siteActionBusy}>
                                {t("common.cancel")}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={saveEditSite}
                                disabled={siteActionBusy || !siteDraftLabel.trim() || !siteDraftDomain.trim()}
                              >
                                {t("common.save")}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div key={site.id} className="grid grid-cols-[1fr_1fr_36px] items-center gap-sm border-t border-border px-md py-[9px]">
                            <button
                              type="button"
                              onClick={() => startEditSite(site)}
                              className="truncate border-0 border-b border-dashed border-transparent bg-transparent p-0 text-left text-[13px] text-ink-primary hover:border-border-strong"
                            >
                              {site.label}
                            </button>
                            <span className="truncate font-mono text-[11px] text-ink-muted">{site.domain}</span>
                            <IconButton
                              icon="×"
                              size="sm"
                              aria-label={t("settings.comparisonSites.removeLabel", { label: site.label })}
                              disabled={siteActionBusy}
                              onClick={() => handleRemoveSite(site.id)}
                            />
                          </div>
                        ),
                      )}
                    </div>
                  )}

                  {addingSite ? (
                    <div className="flex flex-col gap-sm rounded-lg border border-dashed border-border-strong p-md">
                      <Input
                        autoFocus
                        label={t("settings.comparisonSites.labelLabel")}
                        placeholder={t("settings.comparisonSites.labelPlaceholder")}
                        value={newSiteLabel}
                        onChange={(e) => setNewSiteLabel(e.target.value)}
                      />
                      <Input
                        label={t("settings.comparisonSites.domainLabel")}
                        placeholder={t("settings.comparisonSites.domainPlaceholder")}
                        value={newSiteDomain}
                        onChange={(e) => setNewSiteDomain(e.target.value)}
                      />
                      <div className="flex justify-end gap-sm">
                        <Button type="button" variant="ghost" size="sm" onClick={toggleAddSite} disabled={siteActionBusy}>
                          {t("common.cancel")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleAddSite}
                          disabled={siteActionBusy || !newSiteLabel.trim() || !newSiteDomain.trim()}
                        >
                          {t("settings.comparisonSites.addButton")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button type="button" variant="outline" size="sm" className="self-start" onClick={toggleAddSite}>
                      {t("settings.comparisonSites.addToggle")}
                    </Button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
