import { Button, cn, FreshnessBadge, Input, Modal, ModalBody, ModalFooter, ModalHeader, ModalTitle } from "shelf-sense-ds";
import { useT } from "shelf-sense-i18n/react";
import { freshnessBadgeLabel } from "../lib/freshness";
import type { EnrichedProduct } from "../lib/productList";
import type { QuickEditState } from "../lib/quickBatchEdit";

export interface QuickBatchEditModalProps {
  quick: QuickEditState | null;
  /** The enriched product matching quick.productId — null while closed, or if the product's gone. */
  product: EnrichedProduct | null;
  onClose: () => void;
  onBump: (delta: number) => void;
  onStartEdit: () => void;
  onDraftChange: (value: string) => void;
  onDraftCommit: () => void;
  onAddExpiresOnChange: (value: string) => void;
  onReset: () => void;
  onSave: () => void;
  onStock: () => void;
  onEditProduct: () => void;
}

const STEPS = [-10, -5, -1, 1, 5, 10];

/**
 * Translated from the merged Claude Design prototype's Quick Batch Edit
 * modal (templates/product-list-alt/ProductListAlt.dc.html). Purely
 * presentational — ProductListPage owns the gesture handling, the
 * QuickEditState, and the actual batch mutation (see quickBatchEdit.ts).
 */
export function QuickBatchEditModal({
  quick,
  product,
  onClose,
  onBump,
  onStartEdit,
  onDraftChange,
  onDraftCommit,
  onAddExpiresOnChange,
  onReset,
  onSave,
  onStock,
  onEditProduct,
}: QuickBatchEditModalProps) {
  const { t, tPlural } = useT();
  const open = !!quick && !!product;
  const delta = quick ? quick.target - quick.base : 0;
  const doesExpire = product?.does_expire ?? true;
  const showExpiry = doesExpire && delta > 0;
  const noExpiryLine = !doesExpire && delta > 0;
  const noNewBatchLine = delta <= 0;
  const decDisabled = !quick || quick.target <= 0;
  const resetDisabled = !quick || delta === 0;

  // Product Add.md's hard-validation rule, reused here: does_expire + a
  // positive delta (i.e. a new batch) + no expires_on is a hard error, not
  // a soft warning. The prototype this was translated from didn't enforce
  // this — same gap found and fixed for real in AddProductModals.
  const saveDisabled = !quick || delta === 0 || (showExpiry && quick.addExpiresOn.trim().length === 0);

  const decHint = !quick
    ? ""
    : delta < 0
      ? t("quickBatchEdit.decHintNegative", { count: Math.abs(delta) })
      : delta > 0
        ? t("quickBatchEdit.decHintPositive", { count: delta })
        : quick.target <= 0
          ? t("quickBatchEdit.decHintEmpty")
          : t("quickBatchEdit.decHintDefault");

  const noNewBatchHint =
    quick && delta < 0 ? t("quickBatchEdit.noNewBatchHintRemoving") : t("quickBatchEdit.noNewBatchHintDefault");

  return (
    <Modal open={open} onClose={onClose} aria-label={t("common.quickBatchEditLabel")} className="max-w-sm">
      <ModalHeader>
        <ModalTitle>{product?.short_description ?? ""}</ModalTitle>
      </ModalHeader>
      <ModalBody className="flex max-h-[62vh] flex-col gap-md overflow-y-auto">
        {quick && product && (
          <>
            <div className="flex items-center gap-md rounded-lg border border-border bg-surface-1 p-md">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted">{t("quickBatchEdit.inStockLabel")}</span>
                {quick.editing ? (
                  <Input
                    type="number"
                    min={0}
                    autoFocus
                    className="max-w-[120px]"
                    value={quick.draft}
                    onChange={(e) => onDraftChange(e.target.value)}
                    onBlur={onDraftCommit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onDraftCommit();
                    }}
                  />
                ) : (
                  <div className="flex items-baseline gap-sm">
                    <button
                      type="button"
                      onClick={onStartEdit}
                      title={t("quickBatchEdit.typeExactQuantityTitle")}
                      className="border-0 border-b border-dashed border-border-strong bg-transparent p-0 font-mono text-[34px] font-semibold leading-[1.05] text-ink-primary"
                    >
                      {quick.target}
                    </button>
                    {delta !== 0 && (
                      <span
                        className={cn("font-mono text-[13px] font-semibold", delta > 0 ? "text-success" : "text-danger")}
                      >
                        {delta > 0 ? "+" : "−"}
                        {t("quickBatchEdit.pendingCount", { count: Math.abs(delta) })}
                      </span>
                    )}
                  </div>
                )}
                <span className="text-xs text-ink-muted">{tPlural("quickBatchEdit.batchesCount", product.batches.length)}</span>
              </div>
              <FreshnessBadge status={product.status} label={freshnessBadgeLabel(product.status, t)} />
            </div>

            <div className="flex flex-col gap-sm pt-sm">
              <div className="grid grid-cols-6 gap-[6px]">
                {STEPS.map((n) => (
                  <Button
                    key={n}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={n < 0 && decDisabled}
                    onClick={() => onBump(n)}
                  >
                    {n > 0 ? `+${n}` : n}
                  </Button>
                ))}
              </div>
              <span className="text-xs leading-relaxed text-ink-muted">{decHint}</span>
            </div>

            <div className="flex flex-col gap-sm border-t border-border pt-sm">
              {showExpiry && (
                <Input
                  label={t("common.expiresOnLabel")}
                  type="date"
                  hint={t("quickBatchEdit.expiresOnHint")}
                  value={quick.addExpiresOn}
                  onChange={(e) => onAddExpiresOnChange(e.target.value)}
                />
              )}
              {noExpiryLine && <p className="text-xs text-ink-muted">{t("quickBatchEdit.noExpiryNewBatch")}</p>}
              {noNewBatchLine && <p className="text-xs text-ink-muted">{noNewBatchHint}</p>}
            </div>

            <div className="flex gap-sm border-t border-border pt-sm">
              <Button type="button" variant="outline" size="sm" onClick={onStock}>
                {t("quickBatchEdit.stockButton")}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={onEditProduct}>
                {t("quickBatchEdit.editProductButton")}
              </Button>
            </div>
          </>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" size="sm" disabled={resetDisabled} onClick={onReset}>
          {t("quickBatchEdit.resetButton")}
        </Button>
        <Button variant="outline" size="sm" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button size="sm" disabled={saveDisabled} onClick={onSave}>
          {t("common.save")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
