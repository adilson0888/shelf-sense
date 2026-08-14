import { Button, Modal, ModalBody, ModalFooter, ModalHeader, ModalTitle } from "shelf-sense-ds";
import { useT } from "shelf-sense-i18n/react";
import { useBarcodeScan } from "../lib/barcodeScanner";

export interface BarcodeCaptureModalProps {
  open: boolean;
  /** Fires once per activation, on the first successful decode. */
  onDetect: (code: string) => void;
  /** The existing "Edit manually" escape hatch, retargeted — falls back to the blank /products/add page (specs/Barcode Scanner & Product info scrape.md). */
  onCancel: () => void;
}

/**
 * The sole surviving modal from Product Add.md's old five-step flow — see
 * specs/Barcode Scanner & Product info scrape.md's Out of scope for why
 * method choice/photo/match-review/unlink-warning are all retired. Purely
 * presentational; Inventory.tsx/ProductList.tsx own what happens on detect
 * (local-match lookup, external lookup, navigation).
 */
export function BarcodeCaptureModal({ open, onDetect, onCancel }: BarcodeCaptureModalProps) {
  const { t } = useT();
  const { videoRef, error } = useBarcodeScan(open, onDetect);

  return (
    <Modal open={open} onClose={onCancel} aria-label={t("addProduct.captureAriaLabel")} className="max-w-sm">
      <ModalHeader>
        <ModalTitle>{t("addProduct.scanOption.title")}</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <div className="relative flex h-[190px] items-center justify-center overflow-hidden rounded-lg bg-[#0d0f12]">
          <video ref={videoRef} muted playsInline className="absolute inset-0 h-full w-full object-cover" />
          <div className="relative h-[120px] w-[200px] rounded-lg border-2 border-white/55" />
          <div className="ss-scan-line absolute left-[calc(50%-100px)] top-[34px] h-0.5 w-[200px] bg-brand-400 shadow-[0_0_12px_var(--ss-brand-400)]" />
        </div>
        <p className="mt-sm text-center text-sm text-ink-secondary">{t("addProduct.lineUpBarcodeLabel")}</p>
        {error === "camera-denied" && <p className="mt-xs text-center text-xs text-danger">{t("addProduct.cameraDeniedHint")}</p>}
        {error === "unsupported" && <p className="mt-xs text-center text-xs text-danger">{t("addProduct.cameraUnsupportedHint")}</p>}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {t("addProduct.editManually")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
