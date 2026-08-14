import { useMemo, useState } from "react";
import { Alert, Button, Input, Modal, ModalBody, ModalFooter, ModalHeader, ModalTitle } from "shelf-sense-ds";
import { useT } from "shelf-sense-i18n/react";
import { ApiError, updateProduct } from "../lib/api";
import { buildLinkBarcodePayload } from "../lib/addProduct";
import { matchesSearch } from "../lib/inventory";
import type { Product } from "../types";

export interface LinkExistingProductModalProps {
  open: boolean;
  /** The scanned-but-unlinked barcode this modal is trying to attach somewhere. */
  barcode: string;
  products: Product[];
  onClose: () => void;
  onLinked: (updatedProduct: Product) => void;
}

/**
 * specs/Barcode Scanner & Product info scrape.md's escape hatch for when
 * neither local-match nor the external lookup pipeline found the right
 * product. One Modal, two internal views (search results / confirm) rather
 * than two stacked Modals — simpler than nesting.
 */
export function LinkExistingProductModal({ open, barcode, products, onClose, onLinked }: LinkExistingProductModalProps) {
  const { t } = useT();
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<Product | null>(null);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const results = useMemo(() => products.filter((p) => matchesSearch(p, query)), [products, query]);

  function reset() {
    setQuery("");
    setTarget(null);
    setError(null);
  }
  function handleClose() {
    reset();
    onClose();
  }

  async function confirmLink() {
    if (!target) return;
    setLinking(true);
    setError(null);
    try {
      const { product: updated } = await updateProduct(target.id, buildLinkBarcodePayload(target, barcode));
      onLinked(updated);
      reset();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("addProduct.linkExistingError"));
    } finally {
      setLinking(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} aria-label={t("addProduct.linkExistingTitle")} className="max-w-sm">
      <ModalHeader>
        <ModalTitle>{target ? t("addProduct.linkExistingConfirmTitle") : t("addProduct.linkExistingTitle")}</ModalTitle>
      </ModalHeader>
      {target ? (
        <>
          <ModalBody className="flex flex-col gap-sm">
            <p className="text-sm leading-relaxed text-ink-secondary">
              {t("addProduct.linkExistingConfirmBody", { name: target.short_description })}
            </p>
            {error && (
              <Alert variant="danger" title={t("common.saveErrorTitle")}>
                {error}
              </Alert>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" size="sm" onClick={() => setTarget(null)} disabled={linking}>
              {t("common.cancel")}
            </Button>
            <Button size="sm" onClick={confirmLink} disabled={linking}>
              {linking ? t("common.saving") : t("addProduct.linkExistingConfirmButton")}
            </Button>
          </ModalFooter>
        </>
      ) : (
        <>
          <ModalBody className="flex max-h-[62vh] flex-col gap-sm overflow-y-auto">
            <div className="relative">
              <Input
                className="pr-9"
                placeholder={t("addProduct.linkExistingSearchPlaceholder")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label={t("productList.clearSearchLabel")}
                  title={t("productList.clearSearchLabel")}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[13px] text-ink-muted hover:bg-surface-2"
                >
                  ✕
                </button>
              )}
            </div>
            {results.length === 0 ? (
              <p className="px-1 py-sm text-xs text-ink-muted">{t("addProduct.linkExistingNoResults")}</p>
            ) : (
              results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setTarget(p)}
                  className="rounded-lg border border-border bg-surface-1 p-sm text-left hover:border-ink-primary hover:bg-surface-2"
                >
                  <div className="text-[15px] font-semibold text-ink-primary">{p.short_description}</div>
                  {p.long_description && <div className="mt-[3px] text-sm text-ink-secondary">{p.long_description}</div>}
                </button>
              ))
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" size="sm" onClick={handleClose}>
              {t("common.cancel")}
            </Button>
          </ModalFooter>
        </>
      )}
    </Modal>
  );
}
