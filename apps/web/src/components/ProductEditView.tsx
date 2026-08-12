import { Alert, Button, Input, Modal, ModalBody, ModalFooter, ModalHeader, ModalTitle, Switch } from "shelf-sense-ds";
import {
  canSave,
  isRenamed,
  newBarcodeValid,
  removeBarcodesMessage,
  saveSummary,
  type ProductEditState,
} from "../lib/productEdit";

export interface ProductEditViewProps {
  edit: ProductEditState | null;
  /** Batches for this product that currently carry a real expires_on — drives the "turning expiry off clears N dates" warning. */
  datedBatchCount: number;
  onClose: () => void;
  onFieldChange: (key: "short" | "long" | "minQty" | "fresh", value: string) => void;
  onDoesExpireChange: (value: boolean) => void;
  onNewAliasChange: (value: string) => void;
  onAddAlias: () => void;
  onRemoveAlias: (alias: string) => void;
  onToggleBarcodeSelected: (id: string) => void;
  onToggleSelectAllBarcodes: () => void;
  onStartEditBarcodeDesc: (id: string) => void;
  onBarcodeDescChange: (id: string, value: string) => void;
  onCommitBarcodeDescEdit: () => void;
  onToggleAddBarcode: () => void;
  onNewBarcodeDescChange: (value: string) => void;
  onNewBarcodeCodeChange: (value: string) => void;
  onAddBarcode: () => void;
  onAskRemoveSelectedBarcodes: () => void;
  onConfirmRemoveSelectedBarcodes: () => void;
  /** Confirms whichever move is pending — a barcode conflict or an alias conflict (edit.confirm names which). */
  onConfirmMove: () => void;
  onCancelConfirm: () => void;
  /** First click arms Save ("Confirm?"); a second click while armed commits. */
  onSave: () => void;
}

/**
 * Full-screen product-identity editor, reached from Quick Batch Edit's
 * "Edit product" button. Translated from the approved Claude Design
 * prototype (templates/product-list-alt/ProductListAlt.dc.html) — same
 * layout, alias tag-chip treatment, and barcode table, with one deliberate
 * change from what was prototyped: Save uses the real confirm-to-commit
 * button (shelf-sense-ds's `variant="confirm"`) instead of the prototype's
 * placeholder "Save changes?" modal, which only existed because that button
 * pattern didn't exist in the DS yet when this was prototyped.
 *
 * Purely presentational — ProductListPage owns the ProductEditState and all
 * the business logic (lib/productEdit.ts), including the barcode/alias
 * cross-product conflict checks the prototype's own mock didn't simulate.
 */
export function ProductEditView({
  edit,
  datedBatchCount,
  onClose,
  onFieldChange,
  onDoesExpireChange,
  onNewAliasChange,
  onAddAlias,
  onRemoveAlias,
  onToggleBarcodeSelected,
  onToggleSelectAllBarcodes,
  onStartEditBarcodeDesc,
  onBarcodeDescChange,
  onCommitBarcodeDescEdit,
  onToggleAddBarcode,
  onNewBarcodeDescChange,
  onNewBarcodeCodeChange,
  onAddBarcode,
  onAskRemoveSelectedBarcodes,
  onConfirmRemoveSelectedBarcodes,
  onConfirmMove,
  onCancelConfirm,
  onSave,
}: ProductEditViewProps) {
  if (!edit) return null;

  const allBarcodesSelected = edit.barcodes.length > 0 && edit.selectedBarcodeIds.length === edit.barcodes.length;
  const saveEnabled = edit.saveArmed || canSave(edit);

  return (
    <>
      <div className="dark fixed inset-0 z-[6] flex justify-center bg-surface-1 font-sans text-ink-primary">
        <div className="flex w-full max-w-[420px] flex-col bg-surface-1">
          <div className="flex flex-shrink-0 items-center gap-md border-b border-border bg-surface-0 px-md pb-[14px] pt-[18px]">
            <button
              type="button"
              onClick={onClose}
              title="Back"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-border bg-surface-1 text-base text-ink-primary"
            >
              ‹
            </button>
            <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">Edit product</span>
              <span className="truncate text-[19px] font-bold tracking-[-0.02em]">{edit.short || "Untitled"}</span>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-lg overflow-y-auto p-md">
            <div className="flex flex-col gap-md">
              <Input
                label="Short description"
                placeholder="e.g. Grated cheese"
                value={edit.short}
                onChange={(e) => onFieldChange("short", e.target.value)}
              />
              {edit.shortError && <Alert variant="danger" title={edit.shortError} />}
              {!edit.shortError && isRenamed(edit) && (
                <Alert
                  variant="info"
                  title="This rename applies everywhere this product is referenced — barcodes and batches key off its id, not this name, so nothing else technically changes."
                />
              )}
              <Input
                label="Long description"
                placeholder="Brand, size, details"
                value={edit.long}
                onChange={(e) => onFieldChange("long", e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-md border-t border-border pt-lg">
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted">Tracking</span>
              <Switch label="Does it expire?" checked={edit.doesExpire} onCheckedChange={onDoesExpireChange} />
              {!edit.doesExpire && datedBatchCount > 0 && (
                <Alert
                  variant="warning"
                  title={
                    datedBatchCount === 1
                      ? "1 batch still has an expiry date. Saving will clear it."
                      : `${datedBatchCount} batches still have expiry dates. Saving will clear them.`
                  }
                />
              )}
              {edit.doesExpire && (
                <Input
                  label="Freshness threshold"
                  type="number"
                  min={0}
                  placeholder="Optional"
                  hint="Days before expiry to flag as expiring soon."
                  value={edit.fresh}
                  onChange={(e) => onFieldChange("fresh", e.target.value)}
                />
              )}
              <Input
                label="Minimum quantity"
                type="number"
                min={0}
                placeholder="Optional"
                hint="Warn me when stock falls to this."
                value={edit.minQty}
                onChange={(e) => onFieldChange("minQty", e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-sm border-t border-border pt-lg">
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted">Also known as</span>
              {edit.aliases.length > 0 && (
                <div className="flex flex-wrap gap-[6px]">
                  {edit.aliases.map((a) => (
                    <span
                      key={a}
                      className="inline-flex max-w-full items-center gap-[7px] whitespace-nowrap rounded-full border border-border bg-surface-2 py-[5px] pl-[11px] pr-[8px] text-xs text-ink-secondary"
                    >
                      <span className="overflow-hidden text-ellipsis">{a}</span>
                      <button
                        type="button"
                        onClick={() => onRemoveAlias(a)}
                        title="Remove"
                        className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full border-0 bg-surface-0 text-[11px] leading-none text-ink-muted"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {edit.aliasError && <Alert variant="danger" title={edit.aliasError} />}
              <div className="flex items-end gap-sm">
                <div className="flex-1">
                  <Input
                    placeholder="Add an alias for search"
                    value={edit.newAlias}
                    onChange={(e) => onNewAliasChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onAddAlias();
                    }}
                  />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={onAddAlias}>
                  Add
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-sm border-t border-border pt-lg">
              <div className="flex min-h-[32px] items-center justify-between gap-sm">
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted">Barcodes</span>
                {edit.selectedBarcodeIds.length > 0 && (
                  <div className="flex items-center gap-sm">
                    <span className="text-[11px] text-ink-muted">{edit.selectedBarcodeIds.length} selected</span>
                    <Button type="button" variant="danger" size="sm" onClick={onAskRemoveSelectedBarcodes}>
                      Remove
                    </Button>
                  </div>
                )}
              </div>
              <div className="overflow-hidden rounded-lg border border-border bg-surface-0">
                <div className="grid grid-cols-[28px_1fr_110px] items-center gap-sm bg-surface-2 px-md py-[9px] font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">
                  <input
                    type="checkbox"
                    title="Select all"
                    checked={allBarcodesSelected}
                    onChange={onToggleSelectAllBarcodes}
                    className="h-[15px] w-[15px] accent-brand-600"
                  />
                  <span>Description</span>
                  <span>Code</span>
                </div>
                {edit.barcodes.length === 0 ? (
                  <p className="border-t border-border px-md py-[14px] text-xs text-ink-muted">
                    No barcodes linked. Scanning one during Add product links it here.
                  </p>
                ) : (
                  edit.barcodes.map((b) => (
                    <div
                      key={b.id}
                      className="grid grid-cols-[28px_1fr_110px] items-center gap-sm border-t border-border px-md py-[9px]"
                    >
                      <input
                        type="checkbox"
                        checked={edit.selectedBarcodeIds.includes(b.id)}
                        onChange={() => onToggleBarcodeSelected(b.id)}
                        className="h-[15px] w-[15px] accent-brand-600"
                      />
                      {edit.editingBarcodeId === b.id ? (
                        <Input
                          autoFocus
                          value={b.description}
                          onChange={(e) => onBarcodeDescChange(b.id, e.target.value)}
                          onBlur={onCommitBarcodeDescEdit}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === "Escape") onCommitBarcodeDescEdit();
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => onStartEditBarcodeDesc(b.id)}
                          title="Edit description"
                          className="truncate border-0 border-b border-dashed border-transparent bg-transparent p-0 text-left text-[13px] text-ink-primary hover:border-border-strong"
                        >
                          {b.description || <span className="text-ink-muted">Untitled</span>}
                        </button>
                      )}
                      <span className="truncate font-mono text-[11px] text-ink-muted">{b.code}</span>
                    </div>
                  ))
                )}
              </div>
              {edit.addBarcodeOpen ? (
                <div className="flex flex-col gap-sm rounded-lg border border-dashed border-border-strong p-md">
                  <Input
                    label="Description"
                    placeholder="e.g. Queijo Ralado 100g"
                    value={edit.newBarcodeDesc}
                    onChange={(e) => onNewBarcodeDescChange(e.target.value)}
                  />
                  <Input
                    label="Code"
                    placeholder="13 digits"
                    value={edit.newBarcodeCode}
                    onChange={(e) => onNewBarcodeCodeChange(e.target.value)}
                  />
                  <div className="flex justify-end gap-sm">
                    <Button type="button" variant="ghost" size="sm" onClick={onToggleAddBarcode}>
                      Cancel
                    </Button>
                    <Button type="button" size="sm" disabled={!newBarcodeValid(edit)} onClick={onAddBarcode}>
                      Add code
                    </Button>
                  </div>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" className="self-start" onClick={onToggleAddBarcode}>
                  + Add barcode
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-shrink-0 flex-col gap-sm border-t border-border bg-surface-0 px-md py-md">
            {edit.saveArmed && <p className="text-xs text-ink-muted">{saveSummary(edit)}</p>}
            <div className="flex justify-end gap-sm">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                variant={edit.saveArmed ? "confirm" : "primary"}
                size="sm"
                disabled={!saveEnabled}
                onClick={onSave}
              >
                {edit.saveArmed ? "Confirm?" : "Save changes"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={edit.confirm?.type === "removeBarcodes"}
        onClose={onCancelConfirm}
        aria-label="Remove barcodes?"
        className="dark max-w-sm"
      >
        <ModalHeader>
          <ModalTitle>Remove barcodes?</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <p className="text-sm leading-relaxed text-ink-secondary">{removeBarcodesMessage(edit)}</p>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" size="sm" onClick={onCancelConfirm}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirmRemoveSelectedBarcodes}>
            Remove
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        open={edit.confirm?.type === "barcode" || edit.confirm?.type === "alias"}
        onClose={onCancelConfirm}
        aria-label="Move this?"
        className="dark max-w-sm"
      >
        <ModalHeader>
          <ModalTitle>{edit.confirm?.type === "alias" ? "Move this alias?" : "Move this barcode?"}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <p className="text-sm leading-relaxed text-ink-secondary">
            {edit.confirm?.type === "barcode" &&
              `This barcode is currently linked to "${edit.confirm.ownerName}." Continuing will unlink it from that product and link it to this one instead.`}
            {edit.confirm?.type === "alias" &&
              `"${edit.confirm.alias}" is already an alias of "${edit.confirm.ownerName}." Continuing will remove it from that product and add it to this one instead.`}
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" size="sm" onClick={onCancelConfirm}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirmMove}>
            Unlink and continue
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
