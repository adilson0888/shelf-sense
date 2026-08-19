import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, Button, DataTable, Footer, IconButton, Input, Popover, PopoverItem, type DataTableColumn } from "shelf-sense-ds";
import { useT } from "shelf-sense-i18n/react";
import { ScopeTile } from "../components/ScopeTile";
import { SectionHeader } from "../components/SectionHeader";
import { usePreferencesStore } from "../lib/preferencesStore";
import { useProductsStore } from "../lib/productsStore";
import { ApiError, createBatch, lookupBarcode, updateBatch, updateProduct } from "../lib/api";
import { isBarcodeScanSupported } from "../lib/barcodeScanner";
import type { AddProductLocationState } from "./AddProduct";
import { enrichProduct, matchesSearch, type InventoryDefaults } from "../lib/inventory";
import {
  compareByName,
  effectiveFreshnessThresholdDays,
  effectiveMinimalQuantity,
  isRegular,
  matchesExpiryFilter,
  matchesTypeFilter,
  type ExpiryFilter,
  type TypeFilter,
} from "../lib/productList";
import {
  bumpQuickEdit,
  commitQuickEditDraft,
  openQuickEditState,
  planQuickEdit,
  resetQuickEdit,
  type QuickEditState,
} from "../lib/quickBatchEdit";
import {
  addAlias,
  addBarcode,
  armSave,
  buildEditProductPayload,
  buildSaveResult,
  cancelAddBarcodeScan,
  cancelConfirm,
  changeBarcodeDesc,
  commitBarcodeDescEdit,
  confirmAliasMove,
  confirmBarcodeMove,
  openAddBarcode,
  openProductEditState,
  prefillNewBarcodeFromScan,
  removeAlias,
  removeSelectedBarcodes,
  setDoesExpire,
  setField,
  setNewAlias,
  setNewBarcodeCode,
  setNewBarcodeDesc,
  startAddBarcodeLookup,
  startEditBarcodeDesc,
  toggleAddBarcode,
  toggleBarcodeSelected,
  toggleSelectAllBarcodes,
  type ProductEditState,
} from "../lib/productEdit";
import { BarcodeCaptureModal } from "../components/BarcodeCaptureModal";
import { QuickBatchEditModal } from "../components/QuickBatchEditModal";
import { ProductEditView } from "../components/ProductEditView";
import type { Product } from "../types";

const SAVED_MESSAGE_DELAY_MS = 2600;
// Same long-press threshold Inventory.tsx's own hold-to-open gesture uses.
const HOLD_MS = 480;

interface PopoverState {
  productId: string;
  x: number;
  y: number;
}

/**
 * specs/Product List.md — a flat, filterable, searchable table of every
 * product regardless of current stock, distinct from Inventory.tsx's
 * grouped/stock-triage view (which excludes zero-quantity products; this
 * screen is one of the two places specs/BACKLOG.md's "Where a zero-quantity
 * product surfaces" entry points at). Reuses Inventory's own building
 * blocks wherever they already fit — enrichProduct/matchesSearch (lib/
 * inventory.ts), the Add Product flow, Quick Batch Edit modal, and Product
 * Edit overlay — rather than re-deriving any of them.
 *
 * Reached via a new route, /products, added alongside Inventory's / and
 * Settings' /settings inside AppShell (see lib/menu.ts).
 */
export function ProductListPage() {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>("all");
  // Collapsible search/filters section — same SectionHeader pattern
  // Settings.tsx uses for its own categories. Open by default, unlike
  // Settings' Default Options/User Preferences, since finding a product is
  // this page's primary interaction, not a secondary one.
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [popover, setPopover] = useState<PopoverState | null>(null);

  const { products, batches, setProducts, setBatches, loading, error, refetch } = useProductsStore();
  const { preferences } = usePreferencesStore();
  const i18n = useT();
  const { t, tPlural } = i18n;
  const navigate = useNavigate();
  const location = useLocation();
  const [justSavedMessage, setJustSavedMessage] = useState<string | null>(
    () => (location.state as AddProductLocationState | null)?.justSavedMessage ?? null,
  );

  // --- Add Product flow: barcode-scan-first entry (specs/Barcode Scanner &
  // Product info scrape.md), identical wiring to Inventory.tsx's own -----
  const [scanOpen, setScanOpen] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);

  // --- Product Edit (identical wiring to Inventory.tsx's own) ------------
  const [edit, setEdit] = useState<ProductEditState | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editSaveError, setEditSaveError] = useState<string | null>(null);

  // --- Quick Batch Edit, opened via long-press — same gesture and timing
  // as Inventory.tsx's own, minus its swipe-to-reveal panel (this page's
  // per-row actions already live in the "⋯" popover column instead).
  const [quick, setQuick] = useState<QuickEditState | null>(null);
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickSaveError, setQuickSaveError] = useState<string | null>(null);
  // Mutable, non-render-triggering bookkeeping for the in-flight hold —
  // must be read synchronously inside pointer handlers, not via state,
  // same reasoning Inventory.tsx's own pressRef documents.
  const pressRef = useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null);
  const holdTimerRef = useRef<number | null>(null);

  const savedMessageTimer = useRef<number | null>(null);
  // Same one-shot "just saved"/"just linked" consumption as Inventory.tsx's own.
  useEffect(() => {
    if ((location.state as AddProductLocationState | null)?.justSavedMessage) {
      navigate(location.pathname, { replace: true, state: {} });
      savedMessageTimer.current = window.setTimeout(() => setJustSavedMessage(null), SAVED_MESSAGE_DELAY_MS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot on mount only
  }, []);
  useEffect(
    () => () => {
      if (savedMessageTimer.current) clearTimeout(savedMessageTimer.current);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    },
    [],
  );

  const today = useMemo(() => new Date(), []);

  const listDefaults: InventoryDefaults = useMemo(
    () => ({
      freshnessThresholdDays: preferences.default_freshness_threshold_days,
      minimalQuantity: preferences.default_minimal_quantity,
      minimalPercentage: preferences.default_minimal_percentage,
    }),
    [preferences.default_freshness_threshold_days, preferences.default_minimal_quantity, preferences.default_minimal_percentage],
  );

  const filtered = useMemo(
    () =>
      products
        .filter(
          (p) =>
            matchesSearch(p, query) && matchesTypeFilter(p, typeFilter, listDefaults) && matchesExpiryFilter(p, expiryFilter),
        )
        .sort((a, b) => compareByName(a, b, i18n.locale)),
    [products, query, typeFilter, expiryFilter, listDefaults, i18n.locale],
  );

  // Each filter row's own tile counts are independent of the other active
  // filter/search — same convention Inventory.tsx's Attention/Low-stock
  // tile counts already use (computed from the full list, not `filtered`).
  const countAll = products.length;
  const countRegular = useMemo(() => products.filter((p) => isRegular(p, listDefaults)).length, [products, listDefaults]);
  const countOccasional = countAll - countRegular;
  const countExpires = useMemo(() => products.filter((p) => p.does_expire).length, [products]);
  const countNoExpiry = countAll - countExpires;
  const hasFilters = query.length > 0 || typeFilter !== "all" || expiryFilter !== "all";

  const quickProduct = useMemo(() => {
    if (!quick) return null;
    const product = products.find((p) => p.id === quick.productId);
    if (!product) return null;
    return enrichProduct(
      product,
      batches.filter((b) => b.product_id === product.id),
      today,
      listDefaults,
      i18n,
    );
  }, [quick, products, batches, today, listDefaults, i18n]);

  const editDatedBatchCount = useMemo(
    () => (edit ? batches.filter((b) => b.product_id === edit.productId && b.expires_on !== null).length : 0),
    [batches, edit],
  );

  function clearFilters() {
    setQuery("");
    setTypeFilter("all");
    setExpiryFilter("all");
  }

  // --- Quick Batch Edit ---------------------------------------------------

  function openQuick(id: string) {
    const product = products.find((p) => p.id === id);
    if (!product) return;
    // specs/Relative Tracking.md: a percentage-tracked product's stock is
    // stock_percent directly — never a sum of (nonexistent) batches.
    const total =
      product.tracking_mode === "percentage"
        ? (product.stock_percent ?? 0)
        : batches.filter((b) => b.product_id === id).reduce((sum, b) => sum + b.quantity, 0);
    setQuick(openQuickEditState(id, total, product.tracking_mode));
  }
  // Long-press: pointer down starts a threshold timer; any real movement
  // (e.g. a scroll) cancels it before it fires. Same shape as Inventory
  // .tsx's own handlePressStart/Move/End, minus the swipe bookkeeping.
  function handleRowPressStart(row: Product, e: ReactPointerEvent<HTMLTableRowElement>) {
    if (e.button && e.button !== 0) return;
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    pressRef.current = { id: row.id, x: e.clientX, y: e.clientY, moved: false };
    holdTimerRef.current = window.setTimeout(() => {
      const press = pressRef.current;
      if (!press || press.moved) return;
      pressRef.current = null;
      openQuick(press.id);
    }, HOLD_MS);
  }
  function handleRowPressMove(e: ReactPointerEvent<HTMLTableRowElement>) {
    const press = pressRef.current;
    if (!press) return;
    const dx = e.clientX - press.x;
    const dy = e.clientY - press.y;
    if (!press.moved && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      press.moved = true;
      if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    }
  }
  function handleRowPressEnd() {
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    pressRef.current = null;
  }
  function quickClose() {
    setQuick(null);
  }
  function quickBump(delta: number) {
    setQuick((q) => (q ? bumpQuickEdit(q, delta) : q));
  }
  function quickStartEdit() {
    setQuick((q) => (q ? { ...q, editing: true, draft: String(q.target) } : q));
  }
  function quickDraftChange(value: string) {
    setQuick((q) => (q ? { ...q, draft: value } : q));
  }
  function quickDraftCommit() {
    setQuick((q) => (q ? commitQuickEditDraft(q) : q));
  }
  function quickAddExpiresOnChange(value: string) {
    setQuick((q) => (q ? { ...q, addExpiresOn: value } : q));
  }
  function quickAddPriceChange(value: string) {
    setQuick((q) => (q ? { ...q, addPrice: value } : q));
  }
  function quickAddBarcodeIdChange(value: string) {
    setQuick((q) => (q ? { ...q, addBarcodeId: value || null } : q));
  }
  function quickReset() {
    setQuick((q) => (q ? resetQuickEdit(q) : q));
    setQuickSaveError(null);
  }
  /** specs/Prices & Product Differentiation.md — see Inventory.tsx's quickSave for the full explanation; same logic, duplicated per-page like the rest of this file's Quick Batch Edit wiring. */
  async function quickSave() {
    if (!quick) return;
    const product = products.find((p) => p.id === quick.productId);
    if (!product) {
      setQuick(null);
      return;
    }
    if (product.tracking_mode === "percentage") {
      setProducts((ps) => ps.map((p) => (p.id === product.id ? { ...p, stock_percent: quick.target } : p)));
      setQuick(null);
      return;
    }
    const delta = quick.target - quick.base;
    if (delta === 0) {
      setQuick(null);
      return;
    }
    setQuickSaving(true);
    setQuickSaveError(null);
    try {
      const productBatches = batches.filter((b) => b.product_id === quick.productId);
      const plan = planQuickEdit(productBatches, product.does_expire, delta, quick.addExpiresOn, quick.addPrice, quick.addBarcodeId);
      const updated = await Promise.all(
        plan.updates.map((u) => updateBatch(quick.productId, u.batchId, { quantity: u.quantity })),
      );
      const created = plan.create ? await createBatch(quick.productId, plan.create) : null;
      setBatches((bs) => {
        const byId = new Map(updated.map((u) => [u.batch.id, u.batch]));
        const next = bs.map((b) => byId.get(b.id) ?? b).filter((b) => !byId.has(b.id) || byId.get(b.id)!.quantity > 0);
        return created ? [created.batch, ...next] : next;
      });
      setQuick(null);
    } catch (err) {
      setQuickSaveError(err instanceof ApiError ? err.message : t("inventory.genericSaveError"));
    } finally {
      setQuickSaving(false);
    }
  }

  // --- Row actions popover -------------------------------------------------

  function openPopover(e: ReactMouseEvent<HTMLButtonElement>, productId: string) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setPopover({ productId, x: Math.max(8, rect.right - 158), y: rect.bottom + 6 });
  }
  function popoverEditProduct() {
    if (!popover) return;
    const id = popover.productId;
    setPopover(null);
    openProductEdit(id);
  }
  function popoverEditStock() {
    if (!popover) return;
    const id = popover.productId;
    setPopover(null);
    openStock(id);
  }

  // --- Stock Edit — a real route (Stock Edit.md), same as Inventory.tsx's own.
  function openStock(id: string) {
    setQuick(null);
    navigate(`/products/${id}/stock`);
  }

  // --- Product Edit (verbatim from Inventory.tsx — same lib/productEdit.ts
  // pure functions, just this page's own local state) ---------------------

  function openProductEdit(id: string) {
    const product = products.find((p) => p.id === id);
    if (!product) return;
    setQuick(null);
    setEditSaveError(null);
    setEdit(openProductEditState(product));
  }
  function editClose() {
    setEdit(null);
    setEditSaveError(null);
  }
  function editFieldChange(key: "short" | "minQty" | "fresh" | "minPercent", value: string) {
    if (edit) setEdit(setField(edit, key, value));
  }
  function editDoesExpireChange(value: boolean) {
    if (edit) setEdit(setDoesExpire(edit, value));
  }
  function editNewAliasChange(value: string) {
    if (edit) setEdit(setNewAlias(edit, value));
  }
  function editAddAlias() {
    if (edit) setEdit(addAlias(edit, products, t));
  }
  function editRemoveAlias(alias: string) {
    if (edit) setEdit(removeAlias(edit, alias));
  }
  function editToggleBarcodeSelected(id: string) {
    if (edit) setEdit(toggleBarcodeSelected(edit, id));
  }
  function editToggleSelectAllBarcodes() {
    if (edit) setEdit(toggleSelectAllBarcodes(edit));
  }
  function editStartEditBarcodeDesc(id: string) {
    if (edit) setEdit(startEditBarcodeDesc(edit, id));
  }
  function editBarcodeDescChange(id: string, value: string) {
    if (edit) setEdit(changeBarcodeDesc(edit, id, value));
  }
  function editCommitBarcodeDescEdit() {
    if (edit) setEdit(commitBarcodeDescEdit(edit));
  }
  function editToggleAddBarcode() {
    if (edit) setEdit(toggleAddBarcode(edit));
  }
  function editOpenAddBarcode() {
    if (edit) setEdit(openAddBarcode(edit, isBarcodeScanSupported()));
  }
  async function editAddBarcodeDetect(code: string) {
    if (!edit) return;
    setEdit(startAddBarcodeLookup(edit));
    const lookup = await lookupBarcode(code);
    setEdit((current) => (current ? prefillNewBarcodeFromScan(current, code, lookup.long_description || "") : current));
  }
  function editCancelAddBarcodeScan() {
    if (edit) setEdit(cancelAddBarcodeScan(edit));
  }
  function editNewBarcodeDescChange(value: string) {
    if (edit) setEdit(setNewBarcodeDesc(edit, value));
  }
  function editNewBarcodeCodeChange(value: string) {
    if (edit) setEdit(setNewBarcodeCode(edit, value));
  }
  function editAddBarcode() {
    if (edit) setEdit(addBarcode(edit, products));
  }
  function editRemoveSelectedBarcodes() {
    if (edit) setEdit(removeSelectedBarcodes(edit));
  }
  function editConfirmMove() {
    if (!edit || !edit.confirm) return;
    if (edit.confirm.type === "alias") setEdit(confirmAliasMove(edit));
    else if (edit.confirm.type === "barcode") setEdit(confirmBarcodeMove(edit));
  }
  function editCancelConfirm() {
    if (edit) setEdit(cancelConfirm(edit));
  }
  async function editSave() {
    if (!edit) return;
    if (!edit.saveArmed) {
      setEditSaveError(null);
      setEdit(armSave(edit, products, t));
      return;
    }
    const product = products.find((p) => p.id === edit.productId);
    if (!product) {
      setEdit(null);
      return;
    }
    const saveResult = buildSaveResult(edit, product);
    setEditSaving(true);
    setEditSaveError(null);
    try {
      const { product: updatedProduct, batches: updatedBatches } = await updateProduct(
        edit.productId,
        buildEditProductPayload(saveResult),
      );
      setProducts((ps) =>
        ps.map((p) => {
          if (p.id === updatedProduct.id) return updatedProduct;
          const upd = saveResult.otherProductUpdates.find((u) => u.productId === p.id);
          if (!upd) return p;
          return {
            ...p,
            barcodes: p.barcodes.filter((b) => !upd.removeBarcodeCodes.includes(b.code)),
            aliases: p.aliases.filter((a) => !upd.removeAliases.includes(a)),
          };
        }),
      );
      setBatches((bs) => [...bs.filter((b) => b.product_id !== updatedProduct.id), ...updatedBatches]);
      setJustSavedMessage(t("productList.savedProductUpdated", { name: updatedProduct.short_description }));
      if (savedMessageTimer.current) clearTimeout(savedMessageTimer.current);
      savedMessageTimer.current = window.setTimeout(() => setJustSavedMessage(null), SAVED_MESSAGE_DELAY_MS);
      setEdit(null);
    } catch (err) {
      setEditSaveError(err instanceof ApiError ? err.message : t("productList.genericSaveError"));
    } finally {
      setEditSaving(false);
    }
  }

  // --- Add Product flow: barcode-scan-first (verbatim from Inventory.tsx) ---

  function openAdd() {
    if (isBarcodeScanSupported()) {
      setScanOpen(true);
    } else {
      navigate("/products/add", { state: { from: "/products" } satisfies AddProductLocationState });
    }
  }

  async function handleDetect(code: string) {
    setScanOpen(false);
    const match = products.find((p) => p.barcodes.some((b) => b.code === code));
    if (match) {
      openQuick(match.id);
      return;
    }
    setLookupLoading(true);
    try {
      const lookup = await lookupBarcode(code);
      navigate("/products/add", { state: { barcode: code, lookup, from: "/products" } satisfies AddProductLocationState });
    } finally {
      setLookupLoading(false);
    }
  }

  function handleCancelScan() {
    setScanOpen(false);
    navigate("/products/add", { state: { from: "/products" } satisfies AddProductLocationState });
  }

  function onEmptyAction() {
    if (hasFilters) clearFilters();
    else openAdd();
  }

  // --- Table columns --------------------------------------------------------

  function freshnessCell(row: Product) {
    if (!row.does_expire) return <span className="text-ink-muted">—</span>;
    const days = effectiveFreshnessThresholdDays(row, listDefaults) ?? 0;
    const inherited = row.freshness_threshold_days == null;
    return <span className={inherited ? "text-ink-muted" : "text-ink-primary"}>{tPlural("productList.daysValue", days)}</span>;
  }
  function minStockCell(row: Product) {
    // specs/Relative Tracking.md: a percentage-tracked product's low-stock
    // threshold is minimal_percentage, not minimal_quantity — showing the
    // latter here would imply a unit count that was never actually stored.
    if (row.tracking_mode === "percentage") {
      const value = row.minimal_percentage ?? listDefaults.minimalPercentage;
      const inherited = row.minimal_percentage == null;
      return <span className={inherited ? "text-ink-muted" : "text-ink-primary"}>{value}%</span>;
    }
    const value = effectiveMinimalQuantity(row, listDefaults);
    const inherited = row.minimal_quantity == null;
    return <span className={inherited ? "text-ink-muted" : "text-ink-primary"}>{value}</span>;
  }

  const columns: DataTableColumn<Product>[] = useMemo(
    () => [
      { key: "short_description", header: t("common.shortDescriptionLabel"), render: (row) => <span className="text-ink-primary">{row.short_description}</span> },
      { key: "freshness_threshold", header: t("common.freshnessThresholdLabel"), render: freshnessCell },
      { key: "minimal_quantity", header: t("productList.columnMinimumStock"), render: minStockCell },
      {
        key: "actions",
        header: "",
        align: "right",
        render: (row) => (
          <IconButton icon="⋯" aria-label={t("productList.rowActionsLabel")} size="sm" onClick={(e) => openPopover(e, row.id)} />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- freshnessCell/minStockCell close over listDefaults, already a dep
    [t, listDefaults],
  );

  return (
    <div className="flex flex-1 flex-col">
      {/* Same top-[60px] offset as Inventory.tsx — sticks just below AppShell's own sticky app bar. */}
      <header className="sticky top-[60px] z-[3] flex flex-col gap-[14px] border-b border-border bg-surface-0 px-md pb-[12px] pt-[22px]">
        <div className="flex items-center justify-between gap-sm">
          <SectionHeader
            label={t("productList.searchFiltersHeading")}
            open={filtersOpen}
            onToggle={() => setFiltersOpen((v) => !v)}
          />
          <Button size="sm" className="flex-shrink-0" onClick={openAdd}>
            {t("productList.addButton")}
          </Button>
        </div>

        {filtersOpen && (
          <>
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <Input
                className="h-11"
                style={{ paddingLeft: 34, paddingRight: query ? 34 : undefined }}
                placeholder={t("productList.searchPlaceholder")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label={t("productList.clearSearchLabel")}
                  title={t("productList.clearSearchLabel")}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[13px] text-ink-muted hover:bg-surface-2"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex flex-col gap-[6px]">
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">{t("productList.typeFilterLabel")}</span>
              <div className="grid grid-cols-3 gap-sm">
                <ScopeTile
                  active={typeFilter === "all"}
                  count={countAll}
                  label={t("productList.typeAll")}
                  activeClassName="border-ink-primary bg-surface-2 text-ink-primary"
                  onClick={() => setTypeFilter("all")}
                />
                <ScopeTile
                  active={typeFilter === "regular"}
                  count={countRegular}
                  label={t("productList.typeRegular")}
                  activeClassName="border-ink-primary bg-surface-2 text-ink-primary"
                  onClick={() => setTypeFilter("regular")}
                />
                <ScopeTile
                  active={typeFilter === "occasional"}
                  count={countOccasional}
                  label={t("productList.typeOccasional")}
                  activeClassName="border-ink-primary bg-surface-2 text-ink-primary"
                  onClick={() => setTypeFilter("occasional")}
                />
              </div>
            </div>

            <div className="flex flex-col gap-[6px]">
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">{t("productList.expiryFilterLabel")}</span>
              <div className="grid grid-cols-3 gap-sm">
                <ScopeTile
                  active={expiryFilter === "all"}
                  count={countAll}
                  label={t("productList.expiryAll")}
                  activeClassName="border-ink-primary bg-surface-2 text-ink-primary"
                  onClick={() => setExpiryFilter("all")}
                />
                <ScopeTile
                  active={expiryFilter === "expires"}
                  count={countExpires}
                  label={t("productList.expiryExpires")}
                  activeClassName="border-ink-primary bg-surface-2 text-ink-primary"
                  onClick={() => setExpiryFilter("expires")}
                />
                <ScopeTile
                  active={expiryFilter === "no-expiry"}
                  count={countNoExpiry}
                  label={t("productList.expiryDoesnt")}
                  activeClassName="border-ink-primary bg-surface-2 text-ink-primary"
                  onClick={() => setExpiryFilter("no-expiry")}
                />
              </div>
            </div>
          </>
        )}

        <div className="flex items-center justify-between gap-[12px] pb-[2px]">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">
            {tPlural("productList.resultCount", filtered.length)}
          </span>
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="text-[12px] font-semibold text-brand-600 underline">
              {t("productList.clearFilters")}
            </button>
          )}
        </div>
      </header>

      {justSavedMessage && (
        <div className="px-md pt-sm">
          <Alert variant="success" title={justSavedMessage} />
        </div>
      )}
      {lookupLoading && (
        <div className="px-md pt-sm">
          <Alert variant="info" title={t("addProduct.lookingUpProduct")} />
        </div>
      )}

      <div className="flex flex-1 flex-col">
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-[64px] text-[13px] text-ink-muted">{t("productList.loading")}</div>
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-md px-[28px] py-[64px] text-center">
            <Alert variant="danger" title={t("productList.loadError")}>
              {error}
            </Alert>
            <Button variant="outline" onClick={refetch}>
              {t("common.tryAgain")}
            </Button>
          </div>
        ) : filtered.length > 0 ? (
          <div className="pb-[24px] pt-md">
            <DataTable
              columns={columns}
              data={filtered}
              getRowKey={(row) => row.id}
              onRowPointerDown={handleRowPressStart}
              onRowPointerMove={handleRowPressMove}
              onRowPointerUp={handleRowPressEnd}
              onRowPointerCancel={handleRowPressEnd}
              className="rounded-none border-x-0"
            />
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-md px-[28px] py-[64px] text-center">
            <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-dashed border-border-strong font-mono text-[13px] text-ink-muted">
              0
            </div>
            <div className="text-[16px] font-semibold">{hasFilters ? t("productList.emptyFilteredTitle") : t("productList.emptyNoneTitle")}</div>
            <div className="max-w-[260px] text-[13px] text-ink-secondary">
              {hasFilters ? t("productList.emptyFilteredHint") : t("productList.emptyNoneHint")}
            </div>
            <Button onClick={onEmptyAction}>{hasFilters ? t("productList.clearFilters") : t("productList.addFirstProduct")}</Button>
          </div>
        )}
      </div>

      <Footer />

      <Popover open={!!popover} onClose={() => setPopover(null)} position={popover ? { x: popover.x, y: popover.y } : { x: 0, y: 0 }}>
        <PopoverItem onClick={popoverEditProduct}>{t("productList.popoverEditProduct")}</PopoverItem>
        {/* specs/Relative Tracking.md: no Stock Edit view exists for a
            percentage-tracked product — there are no batches to show. */}
        {popover && products.find((p) => p.id === popover.productId)?.tracking_mode === "percentage" ? (
          <PopoverItem disabled title={t("quickBatchEdit.stockDisabledPercentTitle")} className="cursor-not-allowed opacity-50">
            {t("productList.popoverEditStock")}
          </PopoverItem>
        ) : (
          <PopoverItem onClick={popoverEditStock}>{t("productList.popoverEditStock")}</PopoverItem>
        )}
      </Popover>

      <BarcodeCaptureModal open={scanOpen} onDetect={handleDetect} onCancel={handleCancelScan} />

      <QuickBatchEditModal
        quick={quick}
        product={quickProduct}
        onClose={quickClose}
        onBump={quickBump}
        onStartEdit={quickStartEdit}
        onDraftChange={quickDraftChange}
        onDraftCommit={quickDraftCommit}
        onAddExpiresOnChange={quickAddExpiresOnChange}
        onAddPriceChange={quickAddPriceChange}
        onAddBarcodeIdChange={quickAddBarcodeIdChange}
        onReset={quickReset}
        onSave={quickSave}
        onStock={() => quick && openStock(quick.productId)}
        onEditProduct={() => quick && openProductEdit(quick.productId)}
        saving={quickSaving}
        saveError={quickSaveError}
      />

      <ProductEditView
        edit={edit}
        datedBatchCount={editDatedBatchCount}
        onClose={editClose}
        onFieldChange={editFieldChange}
        onDoesExpireChange={editDoesExpireChange}
        onNewAliasChange={editNewAliasChange}
        onAddAlias={editAddAlias}
        onRemoveAlias={editRemoveAlias}
        onToggleBarcodeSelected={editToggleBarcodeSelected}
        onToggleSelectAllBarcodes={editToggleSelectAllBarcodes}
        onStartEditBarcodeDesc={editStartEditBarcodeDesc}
        onBarcodeDescChange={editBarcodeDescChange}
        onCommitBarcodeDescEdit={editCommitBarcodeDescEdit}
        onOpenAddBarcode={editOpenAddBarcode}
        onToggleAddBarcode={editToggleAddBarcode}
        onNewBarcodeDescChange={editNewBarcodeDescChange}
        onNewBarcodeCodeChange={editNewBarcodeCodeChange}
        onAddBarcode={editAddBarcode}
        onAddBarcodeDetect={editAddBarcodeDetect}
        onCancelAddBarcodeScan={editCancelAddBarcodeScan}
        onRemoveSelectedBarcodes={editRemoveSelectedBarcodes}
        onConfirmMove={editConfirmMove}
        onCancelConfirm={editCancelConfirm}
        onSave={editSave}
        saving={editSaving}
        saveError={editSaveError}
      />
    </div>
  );
}
