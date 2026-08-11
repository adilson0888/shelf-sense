import { Button, Input, Modal, ModalBody, ModalFooter, ModalHeader, ModalTitle, Select } from "shelf-sense-ds";
import type { AddFlowStep, AddProductFormState, PrefillSource } from "../lib/addProduct";
import { MOCK_BARCODE_MATCH } from "../lib/addProduct";

export interface AddProductModalsProps {
  step: AddFlowStep;
  form: AddProductFormState;
  prefillSource: PrefillSource;
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
}

const EXPIRE_OPTIONS = [
  { value: "yes", label: "Yes — track an expiry date" },
  { value: "no", label: "No — it doesn't expire" },
];

/**
 * The five Add Product modals, translated from the merged Claude Design
 * prototype (templates/product-list-alt/ProductListAlt.dc.html). Purely
 * presentational — ProductListPage owns all the state and step transitions.
 *
 * Scan/photo capture and the barcode match are simulated (MOCK_BARCODE_MATCH)
 * — apps/api has no real barcode-lookup, vision-identify, or icon-generate
 * endpoint yet (see Product Add.md). This matches the prototype's own
 * fidelity level; wiring real endpoints is separate follow-up work.
 */
export function AddProductModals({
  step,
  form,
  prefillSource,
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
}: AddProductModalsProps) {
  const qtyNum = Number.parseInt(form.qty, 10) || 0;
  const showExpiresOn = form.doesExpire && qtyNum > 0;
  const expiresHiddenReason = form.doesExpire
    ? "Add a quantity above to set an expiry date for this batch."
    : "This product doesn't expire, so no expiry date is needed.";

  // Product Add.md's Non-functional section: does_expire=true + quantity>0
  // + no expires_on is a hard validation error, not a soft warning. (The
  // prototype this was translated from didn't enforce this — checked, and
  // it doesn't — production code should.)
  const saveDisabled = form.short.trim().length === 0 || (showExpiresOn && form.expiresOn.trim().length === 0);

  let prefillNote = "";
  if (prefillSource === "match") {
    prefillNote = `Prefilled from "${MOCK_BARCODE_MATCH.short}". The barcode will move to this new product; give it its own short description.`;
  } else if (prefillSource === "photo") {
    prefillNote = "Prefilled from your photo. This isn't right? Clear it and enter the details manually.";
  }

  return (
    <>
      {/* Step 1 — method choice */}
      <Modal open={step === "method"} onClose={onCloseAll} aria-label="Add a product" className="dark max-w-sm">
        <ModalHeader>
          <ModalTitle>Add a product</ModalTitle>
        </ModalHeader>
        <ModalBody className="flex flex-col gap-sm">
          <MethodOption icon="▥" title="Scan barcode" subtitle="Fastest for packaged goods" onClick={onScan} />
          <MethodOption icon="◉" title="Take a photo" subtitle="Snap the label, we read it" onClick={onPhoto} />
          <MethodOption icon="✎" title="Enter manually" subtitle="Type the details yourself" onClick={onManual} />
        </ModalBody>
      </Modal>

      {/* Step 2 — capture (scan or photo) */}
      <Modal
        open={step === "scan" || step === "photo"}
        onClose={onCloseAll}
        aria-label="Capture"
        className="dark max-w-sm"
      >
        <ModalHeader>
          <ModalTitle>{step === "photo" ? "Take a photo" : "Scan barcode"}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="relative flex h-[190px] items-center justify-center overflow-hidden rounded-lg bg-[#0d0f12]">
            <div className="h-[120px] w-[200px] rounded-lg border-2 border-white/55" />
            <div className="ss-scan-line absolute left-[calc(50%-100px)] top-[34px] h-0.5 w-[200px] bg-brand-400 shadow-[0_0_12px_var(--ss-brand-400)]" />
          </div>
          <p className="mt-sm text-center text-sm text-ink-secondary">
            {step === "photo" ? "Frame the product label." : "Line the barcode up inside the frame."}
          </p>
          <p className="mt-xs text-center text-xs text-ink-muted">
            Placeholder — the live camera view is native and designed separately.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="sm" onClick={onManual}>
            Edit manually
          </Button>
          <Button size="sm" onClick={onCaptureDone}>
            Capture
          </Button>
        </ModalFooter>
      </Modal>

      {/* Step 3 — match review */}
      <Modal open={step === "match"} onClose={onCloseAll} aria-label="We found a match" className="dark max-w-sm">
        <ModalHeader>
          <ModalTitle>We found a match</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <p className="mb-sm font-mono text-xs text-ink-muted">{MOCK_BARCODE_MATCH.barcode}</p>
          <div className="flex items-start gap-sm rounded-lg border border-border bg-surface-1 p-sm">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-surface-2 text-2xl">
              {MOCK_BARCODE_MATCH.icon}
            </div>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-ink-primary">{MOCK_BARCODE_MATCH.short}</div>
              <div className="mt-[3px] text-sm text-ink-secondary">{MOCK_BARCODE_MATCH.long}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onManual}
            className="mt-sm bg-transparent p-0 text-sm text-brand-600 underline"
          >
            This isn't right — edit manually
          </button>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" size="sm" onClick={onAddAsNew}>
            Add as new
          </Button>
          <Button size="sm" onClick={onUseThis}>
            Use this
          </Button>
        </ModalFooter>
      </Modal>

      {/* Step 4 — unlink warning */}
      <Modal open={step === "unlink"} onClose={onBackToMatch} aria-label="Move this barcode?" className="dark max-w-sm">
        <ModalHeader>
          <ModalTitle>Move this barcode?</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <p className="text-sm leading-relaxed text-ink-secondary">
            This barcode is currently linked to "{MOCK_BARCODE_MATCH.short}." Continuing will unlink it from that
            product and link it to the new one instead.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" size="sm" onClick={onBackToMatch}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirmUnlink}>
            Unlink and continue
          </Button>
        </ModalFooter>
      </Modal>

      {/* Step 5 — form */}
      <Modal open={step === "form"} onClose={onCloseAll} aria-label="Product details" className="dark max-w-sm">
        <ModalHeader>
          <ModalTitle>Product details</ModalTitle>
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
                Clear and start blank
              </button>
            </div>
          )}
          <Input
            label="Short description"
            placeholder="e.g. Grated cheese"
            value={form.short}
            onChange={(e) => onFieldChange("short", e.target.value)}
          />
          <Input
            label="Long description"
            placeholder="Brand, size, details"
            value={form.long}
            onChange={(e) => onFieldChange("long", e.target.value)}
          />
          <Select
            label="Does it expire?"
            options={EXPIRE_OPTIONS}
            value={form.doesExpire ? "yes" : "no"}
            onChange={(e) => onFieldChange("doesExpire", e.target.value === "yes")}
          />
          <Input
            label="Quantity"
            type="number"
            min={0}
            placeholder="Optional"
            value={form.qty}
            onChange={(e) => onFieldChange("qty", e.target.value)}
          />
          <Input
            label="Minimum quantity"
            type="number"
            min={0}
            placeholder="Optional"
            hint="Warn me when stock falls to this."
            value={form.minQty}
            onChange={(e) => onFieldChange("minQty", e.target.value)}
          />
          {form.doesExpire && (
            <Input
              label="Freshness threshold"
              type="number"
              min={0}
              placeholder="Optional"
              hint="Days before expiry to flag as expiring soon."
              value={form.fresh}
              onChange={(e) => onFieldChange("fresh", e.target.value)}
            />
          )}
          {showExpiresOn ? (
            <Input
              label="Expires on"
              type="date"
              value={form.expiresOn}
              onChange={(e) => onFieldChange("expiresOn", e.target.value)}
            />
          ) : (
            <p className="text-xs text-ink-muted">{expiresHiddenReason}</p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" size="sm" onClick={onCloseAll}>
            Cancel
          </Button>
          <Button size="sm" disabled={saveDisabled} onClick={onSave}>
            Save product
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
