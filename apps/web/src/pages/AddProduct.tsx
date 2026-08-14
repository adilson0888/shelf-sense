import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, Button, Input, Switch } from "shelf-sense-ds";
import { useT } from "shelf-sense-i18n/react";
import { usePreferencesStore } from "../lib/preferencesStore";
import { useProductsStore } from "../lib/productsStore";
import { ApiError, createProduct, type BarcodeLookupResult } from "../lib/api";
import { buildBlankForm, buildCreateProductPayload, buildScannedForm, type AddProductFormState } from "../lib/addProduct";
import { LinkExistingProductModal } from "../components/LinkExistingProductModal";
import type { Product } from "../types";

/** Passed via navigate(path, { state }) — see Inventory.tsx/ProductList.tsx's "+ Add" wiring. */
export interface AddProductLocationState {
  barcode?: string;
  lookup?: BarcodeLookupResult;
  /** Where to return to on Save/Cancel/Link — the page "+ Add" was clicked from. */
  from?: string;
  justSavedMessage?: string;
}

/**
 * specs/Barcode Scanner & Product info scrape.md: the sole survivor of
 * Product Add.md's old five-modal flow, now a real route (`/products/add`)
 * instead of the fifth modal step — same chrome-less full-screen pattern
 * Product Edit.md/Stock Edit.md already established (no AppShell, a "‹"
 * back control, eyebrow label). Reached blank (unsupported browser,
 * cancelled scan) or prefilled (Open Food Facts/Tavily lookup result),
 * carried via router state rather than local component state, since this
 * is a real navigation now, not a modal step transition.
 */
export function AddProductPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { preferences } = usePreferencesStore();
  const { products, setProducts, setBatches } = useProductsStore();
  const i18n = useT();
  const { t } = i18n;

  const locState = (location.state ?? null) as AddProductLocationState | null;
  const backTo = locState?.from ?? "/";

  const [form, setForm] = useState<AddProductFormState>(() =>
    locState?.barcode && locState.lookup
      ? buildScannedForm(preferences.default_does_expire, locState.barcode, locState.lookup)
      : buildBlankForm(preferences.default_does_expire),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);

  const listDefaults = useMemo(
    () => ({
      freshnessThresholdDays: preferences.default_freshness_threshold_days,
      minimalQuantity: preferences.default_minimal_quantity,
      minimalPercentage: preferences.default_minimal_percentage,
    }),
    [preferences.default_freshness_threshold_days, preferences.default_minimal_quantity, preferences.default_minimal_percentage],
  );

  const isPercentage = form.trackingMode === "percentage";
  const qtyNum = Number.parseInt(form.qty, 10) || 0;
  const showExpiresOn = !isPercentage && form.doesExpire && qtyNum > 0;
  const expiresHiddenReason = form.doesExpire ? t("addProduct.expiresOnHiddenWithExpiry") : t("addProduct.expiresOnHiddenNoExpiry");

  // Product Add.md's Non-functional section: does_expire=true + quantity>0
  // + no expires_on is a hard validation error, not a soft warning.
  const saveDisabled =
    saving || form.short.trim().length === 0 || (showExpiresOn && form.expiresOn.trim().length === 0);

  function setField<K extends keyof AddProductFormState>(key: K, value: AddProductFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  // specs/Relative Tracking.md: switching to "percentage" also forces does_expire off.
  function setTrackingMode(mode: "units" | "percentage") {
    setForm((f) => ({ ...f, trackingMode: mode, doesExpire: mode === "percentage" ? false : f.doesExpire }));
  }
  // Keeps the pending barcode (still unlinked) but drops whatever the lookup prefilled.
  function clearPrefill() {
    setForm((f) => ({ ...buildBlankForm(preferences.default_does_expire), barcode: f.barcode }));
  }

  function goBack() {
    navigate(backTo);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const { product, batch } = await createProduct(buildCreateProductPayload(form, listDefaults));
      setProducts((ps) => [product, ...ps]);
      if (batch) setBatches((bs) => [batch, ...bs]);
      navigate(backTo, { state: { justSavedMessage: t("inventory.productAdded") } });
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : t("inventory.genericSaveError"));
    } finally {
      setSaving(false);
    }
  }

  function handleLinked(updatedProduct: Product) {
    setProducts((ps) => ps.map((p) => (p.id === updatedProduct.id ? updatedProduct : p)));
    setLinkOpen(false);
    navigate(backTo, { state: { justSavedMessage: t("addProduct.linkExistingSuccess", { name: updatedProduct.short_description }) } });
  }

  let prefillNote = "";
  if (form.prefillSource === "open-food-facts") prefillNote = t("addProduct.prefillNoteOpenFoodFacts");
  else if (form.prefillSource === "tavily") prefillNote = t("addProduct.prefillNoteTavily");
  else if (form.barcode && !form.short && !form.long) prefillNote = t("addProduct.prefillNoteNothingFound");

  return (
    <div className="fixed inset-0 z-[6] flex justify-center bg-surface-1 font-sans text-ink-primary">
      <div className="flex w-full max-w-[420px] flex-col bg-surface-1">
        <div className="flex flex-shrink-0 items-center gap-md border-b border-border bg-surface-0 px-md pb-[14px] pt-[18px]">
          <button
            type="button"
            onClick={goBack}
            title={t("productEdit.backTitle")}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-border bg-surface-1 text-base text-ink-primary"
          >
            ‹
          </button>
          <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">{t("addProduct.eyebrow")}</span>
            <span className="truncate text-[19px] font-bold tracking-[-0.02em]">{t("addProduct.productDetailsTitle")}</span>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-md overflow-y-auto p-md">
          {prefillNote && (
            <div className="flex flex-col gap-sm rounded-md border border-border bg-info-bg p-sm">
              <span className="text-xs leading-relaxed text-info">{prefillNote}</span>
              {(form.short || form.long) && (
                <button
                  type="button"
                  onClick={clearPrefill}
                  className="self-start bg-transparent p-0 text-xs font-semibold text-brand-600 underline"
                >
                  {t("addProduct.clearAndStartBlank")}
                </button>
              )}
            </div>
          )}
          <Input
            label={t("common.shortDescriptionLabel")}
            placeholder={t("common.shortDescriptionPlaceholder")}
            value={form.short}
            onChange={(e) => setField("short", e.target.value)}
          />
          <Input
            label={t("common.longDescriptionLabel")}
            placeholder={t("common.longDescriptionPlaceholder")}
            value={form.long}
            onChange={(e) => setField("long", e.target.value)}
          />
          <Switch
            label={t("addProduct.trackingModeLabel")}
            onLabel={t("addProduct.trackingModePercentage")}
            offLabel={t("addProduct.trackingModeUnits")}
            checked={isPercentage}
            onCheckedChange={(checked) => setTrackingMode(checked ? "percentage" : "units")}
          />
          {isPercentage ? (
            <>
              <p className="text-xs text-ink-muted">{t("addProduct.percentageNoExpiryNote")}</p>
              <Input
                label={t("addProduct.currentPercentLabel")}
                type="number"
                min={0}
                max={100}
                value={form.stockPercent}
                onChange={(e) => setField("stockPercent", e.target.value)}
              />
              <Input
                label={t("addProduct.minimumPercentLabel")}
                type="number"
                min={0}
                max={100}
                placeholder={String(listDefaults.minimalPercentage)}
                hint={t("addProduct.minPercentHint", { default: listDefaults.minimalPercentage })}
                value={form.minPercent}
                onChange={(e) => setField("minPercent", e.target.value)}
              />
            </>
          ) : (
            <>
              <Switch
                label={t("common.doesItExpire")}
                onLabel={t("common.yes")}
                offLabel={t("common.no")}
                checked={form.doesExpire}
                onCheckedChange={(checked) => setField("doesExpire", checked)}
              />
              <Input
                label={t("common.quantityLabel")}
                type="number"
                min={0}
                placeholder={t("common.optionalPlaceholder")}
                value={form.qty}
                onChange={(e) => setField("qty", e.target.value)}
              />
              <Input
                label={t("common.minimumQuantityLabel")}
                type="number"
                min={0}
                placeholder={String(listDefaults.minimalQuantity)}
                hint={t("addProduct.minQtyHint", { default: listDefaults.minimalQuantity })}
                value={form.minQty}
                onChange={(e) => setField("minQty", e.target.value)}
              />
              {form.doesExpire && (
                <Input
                  label={t("common.freshnessThresholdLabel")}
                  type="number"
                  min={0}
                  placeholder={String(listDefaults.freshnessThresholdDays)}
                  hint={t("addProduct.freshnessHint", { default: listDefaults.freshnessThresholdDays })}
                  value={form.fresh}
                  onChange={(e) => setField("fresh", e.target.value)}
                />
              )}
              {showExpiresOn ? (
                <Input
                  label={t("common.expiresOnLabel")}
                  type="date"
                  value={form.expiresOn}
                  onChange={(e) => setField("expiresOn", e.target.value)}
                />
              ) : (
                <p className="text-xs text-ink-muted">{expiresHiddenReason}</p>
              )}
            </>
          )}
          {saveError && (
            <Alert variant="danger" title={t("common.saveErrorTitle")}>
              {saveError}
            </Alert>
          )}
        </div>

        <div className="flex flex-shrink-0 flex-col gap-sm border-t border-border bg-surface-0 px-md py-md">
          <div className="flex justify-end gap-sm">
            <Button variant="outline" size="sm" onClick={goBack}>
              {t("common.cancel")}
            </Button>
            {/* specs/Barcode Scanner & Product info scrape.md: only offered when there's
                a scanned-but-unlinked barcode pending — not on a pure-manual entry. */}
            {form.barcode && (
              <Button variant="outline" size="sm" onClick={() => setLinkOpen(true)}>
                {t("addProduct.linkExistingButton")}
              </Button>
            )}
            <Button size="sm" disabled={saveDisabled} onClick={handleSave}>
              {saving ? t("common.saving") : t("addProduct.saveProductButton")}
            </Button>
          </div>
        </div>
      </div>

      {form.barcode && (
        <LinkExistingProductModal
          open={linkOpen}
          barcode={form.barcode}
          products={products}
          onClose={() => setLinkOpen(false)}
          onLinked={handleLinked}
        />
      )}
    </div>
  );
}
