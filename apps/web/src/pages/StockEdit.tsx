import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, FreshnessBadge, Input, cn } from "shelf-sense-ds";
import { useT } from "shelf-sense-i18n/react";
import { formatExpiryLabel, freshnessBadgeLabel, freshnessStatus } from "../lib/freshness";
import { usePreferencesStore } from "../lib/preferencesStore";
import { useProductsStore } from "../lib/productsStore";
import {
  addBatch,
  armSave,
  canAddBatch,
  cancelEditExp,
  cancelEditQty,
  commitExpEdit,
  commitQtyEdit,
  expDraftChange,
  hasPendingChanges,
  isEditedRow,
  isNewRow,
  newExpChange,
  newQtyChange,
  openStockEditState,
  qtyDraftChange,
  removeSelected,
  saveSummary,
  startEditExp,
  startEditQty,
  toggleAddOpen,
  toggleSelectAll,
  toggleSelected,
  type StockEditState,
} from "../lib/stockEdit";

/**
 * Full-screen batch editor, reached from Quick Batch Edit's "Stock" button.
 * A real route (/products/:id/stock, Stock Edit.md) rather than local modal
 * state — deliberately outside AppShell's chrome, same reasoning as
 * ProductEditView (see App.tsx). Translated from the approved Claude Design
 * prototype (templates/stock-edit/StockEdit.dc.html) — same header, table,
 * and confirm-to-commit footer, real shelf-sense-ds `variant="confirm"`
 * instead of the prototype's own placeholder, same story as Product Edit.
 */
export function StockEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { products, batches, setBatches } = useProductsStore();
  const { preferences } = usePreferencesStore();
  const i18n = useT();
  const { t } = i18n;
  const product = products.find((p) => p.id === id);

  const [edit, setEdit] = useState<StockEditState | null>(null);

  // Re-initializes only when navigating to a different product's Stock Edit
  // (id changes) — not on every store update, which would blow away
  // in-progress pending edits every time this component re-renders.
  useEffect(() => {
    if (!id) return;
    setEdit(openStockEditState(id, batches.filter((b) => b.product_id === id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function goBack() {
    navigate("/");
  }

  if (!product || !id) {
    goBack();
    return null;
  }
  if (!edit) return null;

  const today = new Date();
  const pending = hasPendingChanges(edit);

  function commit() {
    if (!edit) return;
    setBatches((bs) => [...bs.filter((b) => b.product_id !== edit.productId), ...edit.batches]);
    goBack();
  }

  function handleSave() {
    if (!edit || !hasPendingChanges(edit)) return;
    if (edit.armed) commit();
    else setEdit(armSave(edit));
  }

  const rows = edit.batches.map((b) => ({
    batch: b,
    isNew: isNewRow(edit, b.id),
    isEdited: isEditedRow(edit, b.id),
    status: freshnessStatus(b.expires_on, product.freshness_threshold_days, preferences.default_freshness_threshold_days, today),
    expLabel: product.does_expire
      ? formatExpiryLabel(b.expires_on, product.freshness_threshold_days, preferences.default_freshness_threshold_days, today, i18n)
      : t("freshness.doesNotExpire"),
  }));
  const allChecked = edit.batches.length > 0 && edit.sel.length === edit.batches.length;

  return (
    <div className="fixed inset-0 z-[6] flex justify-center bg-surface-1 font-sans text-ink-primary">
      <div className="flex w-full max-w-[420px] flex-col bg-surface-1">
        <div className="flex flex-shrink-0 items-center gap-md border-b border-border bg-surface-0 px-md pb-[14px] pt-[18px]">
          <button
            type="button"
            onClick={goBack}
            title={t("stockEdit.backToProductList")}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-border bg-surface-1 text-base text-ink-primary"
          >
            ‹
          </button>
          <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">{t("stockEdit.eyebrow")}</span>
            <span className="truncate text-[19px] font-bold tracking-[-0.02em]">{product.short_description}</span>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-md overflow-y-auto p-md">
          <div className="flex min-h-[32px] items-center justify-between gap-sm">
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted">
              {rows.length === 0 ? t("stockEdit.noBatches") : i18n.tPlural("stockEdit.batchesCount", rows.length)}
            </span>
            {edit.sel.length > 0 && (
              <div className="flex items-center gap-sm">
                <span className="text-[11px] text-ink-muted">{i18n.tPlural("common.selectedCount", edit.sel.length)}</span>
                <Button variant="danger" size="sm" onClick={() => setEdit((s) => (s ? removeSelected(s) : s))}>
                  {t("common.remove")}
                </Button>
              </div>
            )}
          </div>

          {rows.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border bg-surface-0">
              <div className="grid grid-cols-[26px_64px_1fr_auto] items-center gap-sm bg-surface-2 px-[10px] py-[9px] font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">
                <input
                  type="checkbox"
                  title={t("common.selectAll")}
                  checked={allChecked}
                  onChange={() => setEdit((s) => (s ? toggleSelectAll(s) : s))}
                  className="h-[15px] w-[15px] cursor-pointer accent-brand-600"
                />
                <span>{t("stockEdit.tableHeaderQty")}</span>
                <span>{t("stockEdit.tableHeaderExpires")}</span>
                <span>{t("stockEdit.tableHeaderStatus")}</span>
              </div>
              {rows.map(({ batch, isNew, isEdited, status, expLabel }) => (
                <div
                  key={batch.id}
                  className={cn(
                    "relative grid grid-cols-[26px_64px_1fr_auto] items-center gap-sm border-t border-border px-[10px] py-[9px]",
                    isNew && "border-l-[3px] border-l-success bg-[color-mix(in_oklab,var(--ss-success)_8%,var(--ss-surface-0))]",
                    isEdited && "border-l-[3px] border-l-info bg-[color-mix(in_oklab,var(--ss-info)_8%,var(--ss-surface-0))]",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={edit.sel.includes(batch.id)}
                    onChange={() => setEdit((s) => (s ? toggleSelected(s, batch.id) : s))}
                    className="h-[15px] w-[15px] cursor-pointer accent-brand-600"
                  />
                  {edit.editingQtyId === batch.id ? (
                    <input
                      type="number"
                      min={0}
                      autoFocus
                      value={edit.qtyDraft}
                      onChange={(e) => setEdit((s) => (s ? qtyDraftChange(s, e.target.value) : s))}
                      onBlur={() => setEdit((s) => (s ? commitQtyEdit(s, batch.id) : s))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") setEdit((s) => (s ? cancelEditQty(s) : s));
                      }}
                      className="w-full rounded-md border border-brand-600 bg-surface-0 px-[7px] py-[6px] font-sans text-[13px] text-ink-primary"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEdit((s) => (s ? startEditQty(s, batch.id, batch.quantity) : s))}
                      title={t("stockEdit.editQuantity")}
                      className="border-0 border-b border-dashed border-transparent bg-transparent p-0 text-left font-mono text-[13px] font-semibold text-ink-primary hover:border-border-strong"
                    >
                      ×{batch.quantity}
                    </button>
                  )}
                  {product.does_expire && edit.editingExpId === batch.id ? (
                    <input
                      type="date"
                      autoFocus
                      value={edit.expDraft}
                      onChange={(e) => setEdit((s) => (s ? expDraftChange(s, e.target.value) : s))}
                      onBlur={() => setEdit((s) => (s ? commitExpEdit(s, batch.id) : s))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") setEdit((s) => (s ? cancelEditExp(s) : s));
                      }}
                      className="w-full rounded-md border border-brand-600 bg-surface-0 px-[7px] py-[6px] font-sans text-[13px] text-ink-primary"
                    />
                  ) : product.does_expire ? (
                    <button
                      type="button"
                      onClick={() => setEdit((s) => (s ? startEditExp(s, batch.id, batch.expires_on) : s))}
                      title={t("stockEdit.editExpiration")}
                      className="truncate border-0 border-b border-dashed border-transparent bg-transparent p-0 text-left text-[13px] text-ink-primary hover:border-border-strong"
                    >
                      {expLabel}
                    </button>
                  ) : (
                    <span className="truncate text-[13px] text-ink-muted">{expLabel}</span>
                  )}
                  <div className="flex items-center justify-end gap-xs">
                    {isNew && (
                      <span className="rounded-full bg-success px-[6px] py-[2px] font-mono text-[9px] uppercase tracking-[0.06em] text-surface-0">
                        {t("stockEdit.newBadge")}
                      </span>
                    )}
                    {isEdited && (
                      <span className="rounded-full bg-info px-[6px] py-[2px] font-mono text-[9px] uppercase tracking-[0.06em] text-surface-0">
                        {t("stockEdit.editedBadge")}
                      </span>
                    )}
                    <FreshnessBadge status={status} label={freshnessBadgeLabel(status, t)} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border-strong px-5 py-10 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-border-strong font-mono text-xs text-ink-muted">
                0
              </div>
              <div className="text-[15px] font-semibold">{t("stockEdit.allBatchesConsumed")}</div>
              <div className="max-w-[240px] text-[13px] text-ink-secondary">{t("stockEdit.noStockHint")}</div>
            </div>
          )}

          {edit.addOpen ? (
            <div className="flex flex-col gap-sm rounded-lg border border-dashed border-border-strong p-md">
              <Input
                label={t("common.quantityLabel")}
                type="number"
                min={1}
                placeholder={t("stockEdit.quantityPlaceholder")}
                value={edit.newQty}
                onChange={(e) => setEdit((s) => (s ? newQtyChange(s, e.target.value) : s))}
              />
              {product.does_expire ? (
                <Input
                  label={t("stockEdit.expirationDateLabel")}
                  type="date"
                  value={edit.newExp}
                  onChange={(e) => setEdit((s) => (s ? newExpChange(s, e.target.value) : s))}
                />
              ) : (
                <p className="text-xs text-ink-muted">{t("stockEdit.noExpiryTrackingHint")}</p>
              )}
              <div className="flex justify-end gap-sm">
                <Button variant="ghost" size="sm" onClick={() => setEdit((s) => (s ? toggleAddOpen(s) : s))}>
                  {t("common.cancel")}
                </Button>
                <Button
                  size="sm"
                  disabled={!canAddBatch(edit, product.does_expire)}
                  onClick={() => setEdit((s) => (s ? addBatch(s, product.does_expire) : s))}
                >
                  {t("stockEdit.addBatchButton")}
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <Button variant="outline" size="sm" onClick={() => setEdit((s) => (s ? toggleAddOpen(s) : s))}>
                <span className="whitespace-nowrap">{t("stockEdit.addBatchToggle")}</span>
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-shrink-0 flex-col gap-sm border-t border-border bg-surface-0 px-md py-[12px]">
          {edit.armed && pending && <p className="text-xs text-ink-secondary">{saveSummary(edit, i18n)}</p>}
          <div className="flex justify-end gap-sm">
            <Button variant="outline" size="sm" onClick={goBack}>
              {t("common.cancel")}
            </Button>
            <Button variant={edit.armed ? "confirm" : "primary"} size="sm" disabled={!pending} onClick={handleSave}>
              {edit.armed ? t("common.confirmQuestion") : t("common.save")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
