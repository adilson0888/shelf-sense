import { useState } from "react";
import { Alert, Button, Modal, ModalBody, ModalFooter, ModalHeader, ModalTitle } from "shelf-sense-ds";
import { useT } from "shelf-sense-i18n/react";
import { ApiError, deleteProduct } from "../lib/api";
import type { Product } from "../types";

export interface DeleteProductModalProps {
  /** The product pending deletion, or null when the modal should be closed. */
  product: Product | null;
  /**
   * This product's current stock — total Batch.quantity for a
   * units-tracked product, or stock_percent (0-100) for a
   * percentage-tracked one. Drives the extra "you'll lose this stock too"
   * warning line; omitted (0) when there's nothing to warn about.
   */
  activeStockCount: number;
  onClose: () => void;
  /** Fired after a successful delete — the caller drops the product (and its batches) from local state and shows its own success message. */
  onDeleted: (deleted: Product) => void;
}

/**
 * specs/Delete products.md — confirms and performs a permanent, cascading
 * delete (batches — including consumed ones, i.e. Price History.md data —
 * aliases, and barcodes all removed via apps/api's onDelete: "cascade"
 * FKs, see that spec's Data section). Same Modal-with-a-danger-button shape
 * LinkExistingProductModal's own confirm step already establishes.
 */
export function DeleteProductModal({ product, activeStockCount, onClose, onDeleted }: DeleteProductModalProps) {
  const { t, tPlural } = useT();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    if (deleting) return; // no backing out mid-request — same guard Save/Confirm flows elsewhere use
    setError(null);
    onClose();
  }

  async function confirmDelete() {
    if (!product) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteProduct(product.id);
      setError(null);
      onDeleted(product);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("productList.deleteError"));
    } finally {
      setDeleting(false);
    }
  }

  const title = product ? t("productList.deleteModalTitle", { name: product.short_description }) : "";

  return (
    <Modal open={!!product} onClose={handleClose} aria-label={title} className="max-w-sm">
      <ModalHeader>
        <ModalTitle>{title}</ModalTitle>
      </ModalHeader>
      <ModalBody className="flex flex-col gap-sm">
        <p className="text-sm leading-relaxed text-ink-secondary">{t("productList.deleteModalBody")}</p>
        {activeStockCount > 0 &&
          (product?.tracking_mode === "percentage" ? (
            <p className="text-sm font-semibold leading-relaxed text-danger">
              {t("productList.deleteModalStockWarningPercent", { count: activeStockCount })}
            </p>
          ) : (
            <p className="text-sm font-semibold leading-relaxed text-danger">
              {tPlural("productList.deleteModalStockWarningUnits", activeStockCount)}
            </p>
          ))}
        {error && (
          <Alert variant="danger" title={t("common.saveErrorTitle")}>
            {error}
          </Alert>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" size="sm" onClick={handleClose} disabled={deleting} autoFocus>
          {t("common.cancel")}
        </Button>
        <Button variant="danger" size="sm" onClick={confirmDelete} loading={deleting}>
          {t("common.delete")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
