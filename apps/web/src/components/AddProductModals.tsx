import { Alert, Button, Input, Modal, ModalBody, ModalFooter, ModalHeader, ModalTitle, Switch } from "shelf-sense-ds";
import { useT } from "shelf-sense-i18n/react";
import type { AddFlowStep, AddProductFormState, PrefillSource } from "../lib/addProduct";
import { MOCK_BARCODE_MATCH } from "../lib/addProduct";
import type { ProductListDefaults } from "../lib/productList";

export interface AddProductModalsProps {
  step: AddFlowStep;
  form: AddProductFormState;
  prefillSource: PrefillSource;
  /** Current global defaults (specs/Settings.md) — previewed as placeholder text on the Minimum quantity/Freshness threshold fields, and what gets saved if either is left blank. */
  defaults: ProductListDefaults;
  onCloseAll: () => void;
  onScan: () => void;
  onPhoto: () => void;
  onManual: () => void;
  onCaptureDone: () => void;
  onUseThis: () => void;
  onAddAsNew: () => void;
  onBackToMatch: () => void;
  onConfirmUnlink: () => void;
  onClearPrefill: () => void;
  onFieldChange: <K extends keyof AddProductFormState>(key: K, value: AddProductFormState[K]) => void;
  onSave: () => void;
  /** True while the POST /products request from a prior Save click is in flight. */
  saving: boolean;
  /** Set when that request failed — shown inline, form stays open so nothing typed is lost. */
  saveError: string | null;
}

/**
 * The five Add Product modals, translated from the merged Claude Design
 * prototype (templates/product-list-alt/ProductListAlt.dc.html). Purely
 * presentational — ProductListPage owns all the state and step transitions.
 *
 * Scan/photo capture and the barcode match are simulated (MOCK_BARCODE_MATCH)
 * — apps/api has no real barcode-lookup or vision-identify endpoint yet (see
 * Product Add.md). This matches the prototype's own fidelity level; wiring
 * real endpoints is separate follow-up work.
 */
export function AddProductModals({
  step,
  form,
  prefillSource,
  defaults,
  onCloseAll,
  onScan,
  onPhoto,
  onManual,
  onCaptureDone,
  onUseThis,
  onAddAsNew,
  onBackToMatch,
  onConfirmUnlink,
  onClearPrefill,
  onFieldChange,
  onSave,
  saving,
  saveError,
}: AddProductModalsProps) {
  const { t } = useT();
  const qtyNum = Number.parseInt(form.qty, 10) || 0;
  const showExpiresOn = form.doesExpire && qtyNum > 0;
  const expiresHiddenReason = form.doesExpire
    ? t("addProduct.expiresOnHiddenWithExpiry")
    : t("addProduct.expiresOnHiddenNoExpiry");

  // Product Add.md's Non-functional section: does_expire=true + quantity>0
  // + no expires_on is a hard validation error, not a soft warning. (The
  // prototype this was translated from didn't enforce this — checked, and
  // it doesn't — production code should.) apps/api enforces this too, but
  // the client shouldn't rely on a round-trip to catch something it already
  // knows.
  const saveDisabled =
    saving || form.short.trim().length === 0 || (showExpiresOn && form.expiresOn.trim().length === 0);

  let prefillNote = "";
  if (prefillSource === "match") {
    prefillNote = t("addProduct.prefillNoteMatch", { name: MOCK_BARCODE_MATCH.short });
  } else if (prefillSource === "photo") {
    prefillNote = t("addProduct.prefillNotePhoto");
  }

  return (
    <>
      {/* Step 1 — method choice */}
      <Modal open={step === "method"} onClose={onCloseAll} aria-label={t("addProduct.methodModalTitle")} className="max-w-sm">
        <ModalHeader>
          <ModalTitle>{t("addProduct.methodModalTitle")}</ModalTitle>
        </ModalHeader>
        <ModalBody className="flex flex-col gap-sm">
          <MethodOption icon="▥" title={t("addProduct.scanOption.title")} subtitle={t("addProduct.scanOption.subtitle")} onClick={onScan} />
          <MethodOption icon="◉" title={t("addProduct.photoOption.title")} subtitle={t("addProduct.photoOption.subtitle")} onClick={onPhoto} />
          <MethodOption icon="✎" title={t("addProduct.manualOption.title")} subtitle={t("addProduct.manualOption.subtitle")} onClick={onManual} />
        </ModalBody>
      </Modal>

      {/* Step 2 — capture (scan or photo) */}
      <Modal
        open={step === "scan" || step === "photo"}
        onClose={onCloseAll}
        aria-label={t("addProduct.captureAriaLabel")}
        className="max-w-sm"
      >
        <ModalHeader>
          <ModalTitle>{step === "photo" ? t("addProduct.photoOption.title") : t("addProduct.scanOption.title")}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="relative flex h-[190px] items-center justify-center overflow-hidden rounded-lg bg-[#0d0f12]">
            <div className="h-[120px] w-[200px] rounded-lg border-2 border-white/55" />
            <div className="ss-scan-line absolute left-[calc(50%-100px)] top-[34px] h-0.5 w-[200px] bg-brand-400 shadow-[0_0_12px_var(--ss-brand-400)]" />
          </div>
          <p className="mt-sm text-center text-sm text-ink-secondary">
            {step === "photo" ? t("addProduct.frameLabel") : t("addProduct.lineUpBarcodeLabel")}
          </p>
          <p className="mt-xs text-center text-xs text-ink-muted">{t("addProduct.cameraPlaceholder")}</p>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="sm" onClick={onManual}>
            {t("addProduct.editManually")}
          </Button>
          <Button size="sm" onClick={onCaptureDone}>
            {t("addProduct.captureButton")}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Step 3 — match review */}
      <Modal open={step === "match"} onClose={onCloseAll} aria-label={t("addProduct.matchFoundTitle")} className="max-w-sm">
        <ModalHeader>
          <ModalTitle>{t("addProduct.matchFoundTitle")}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <p className="mb-sm font-mono text-xs text-ink-muted">{MOCK_BARCODE_MATCH.barcode}</p>
          <div className="rounded-lg border border-border bg-surface-1 p-sm">
            <div className="text-[15px] font-semibold text-ink-primary">{MOCK_BARCODE_MATCH.short}</div>
            <div className="mt-[3px] text-sm text-ink-secondary">{MOCK_BARCODE_MATCH.long}</div>
          </div>
          <button
            type="button"
            onClick={onManual}
            className="mt-sm bg-transparent p-0 text-sm text-brand-600 underline"
          >
            {t("addProduct.notRightEditManually")}
          </button>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" size="sm" onClick={onAddAsNew}>
            {t("addProduct.addAsNew")}
          </Button>
          <Button size="sm" onClick={onUseThis}>
            {t("addProduct.useThis")}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Step 4 — unlink warning */}
      <Modal open={step === "unlink"} onClose={onBackToMatch} aria-label={t("common.moveBarcodeQuestion")} className="max-w-sm">
        <ModalHeader>
          <ModalTitle>{t("common.moveBarcodeQuestion")}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <p className="text-sm leading-relaxed text-ink-secondary">
            {t("addProduct.unlinkWarningBody", { name: MOCK_BARCODE_MATCH.short })}
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" size="sm" onClick={onBackToMatch}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirmUnlink}>
            {t("common.unlinkAndContinue")}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Step 5 — form */}
      <Modal open={step === "form"} onClose={onCloseAll} aria-label={t("addProduct.productDetailsTitle")} className="max-w-sm">
        <ModalHeader>
          <ModalTitle>{t("addProduct.productDetailsTitle")}</ModalTitle>
        </ModalHeader>
        <ModalBody className="flex max-h-[62vh] flex-col gap-md overflow-y-auto">
          {prefillNote && (
            <div className="flex flex-col gap-sm rounded-md border border-border bg-info-bg p-sm">
              <span className="text-xs leading-relaxed text-info">{prefillNote}</span>
              <button
                type="button"
                onClick={onClearPrefill}
                className="self-start bg-transparent p-0 text-xs font-semibold text-brand-600 underline"
              >
                {t("addProduct.clearAndStartBlank")}
              </button>
            </div>
          )}
          <Input
            label={t("common.shortDescriptionLabel")}
            placeholder={t("common.shortDescriptionPlaceholder")}
            value={form.short}
            onChange={(e) => onFieldChange("short", e.target.value)}
          />
          <Input
            label={t("common.longDescriptionLabel")}
            placeholder={t("common.longDescriptionPlaceholder")}
            value={form.long}
            onChange={(e) => onFieldChange("long", e.target.value)}
          />
          <Switch
            label={t("common.doesItExpire")}
            onLabel={t("common.yes")}
            offLabel={t("common.no")}
            checked={form.doesExpire}
            onCheckedChange={(checked) => onFieldChange("doesExpire", checked)}
          />
          <Input
            label={t("common.quantityLabel")}
            type="number"
            min={0}
            placeholder={t("common.optionalPlaceholder")}
            value={form.qty}
            onChange={(e) => onFieldChange("qty", e.target.value)}
          />
          <Input
            label={t("common.minimumQuantityLabel")}
            type="number"
            min={0}
            placeholder={String(defaults.minimalQuantity)}
            hint={t("addProduct.minQtyHint", { default: defaults.minimalQuantity })}
            value={form.minQty}
            onChange={(e) => onFieldChange("minQty", e.target.value)}
          />
          {form.doesExpire && (
            <Input
              label={t("common.freshnessThresholdLabel")}
              type="number"
              min={0}
              placeholder={String(defaults.freshnessThresholdDays)}
              hint={t("addProduct.freshnessHint", { default: defaults.freshnessThresholdDays })}
              value={form.fresh}
              onChange={(e) => onFieldChange("fresh", e.target.value)}
            />
          )}
          {showExpiresOn ? (
            <Input
              label={t("common.expiresOnLabel")}
              type="date"
              value={form.expiresOn}
              onChange={(e) => onFieldChange("expiresOn", e.target.value)}
            />
          ) : (
            <p className="text-xs text-ink-muted">{expiresHiddenReason}</p>
          )}
          {saveError && (
            <Alert variant="danger" title={t("common.saveErrorTitle")}>
              {saveError}
            </Alert>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" size="sm" onClick={onCloseAll}>
            {t("common.cancel")}
          </Button>
          <Button size="sm" disabled={saveDisabled} onClick={onSave}>
            {saving ? t("common.saving") : t("addProduct.saveProductButton")}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}

function MethodOption({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-md rounded-lg border border-border bg-surface-1 p-sm text-left text-ink-primary hover:border-ink-primary hover:bg-surface-2"
    >
      <span className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-2xl leading-none">
        {icon}
      </span>
      <span className="flex min-w-0 flex-col gap-[3px]">
        <span className="text-base font-semibold tracking-tight">{title}</span>
        <span className="text-xs text-ink-muted">{subtitle}</span>
      </span>
      <span className="ml-auto text-sm text-ink-muted">›</span>
    </button>
  );
}
