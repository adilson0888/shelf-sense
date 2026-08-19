# Quick Batch Edit

**Status:** in-progress — UI built in `apps/web` against the approved design and mock data; no real `apps/api` wiring yet

## User story

As someone tracking pantry stock, I want to quickly adjust a product's quantity — using it up or restocking it — right from the product list, so that keeping stock numbers accurate doesn't require a trip to a full batch editor for routine changes.

## Acceptance criteria

- [ ] Given the user is on Inventory, when they hold (long-press, ~480ms) on a product row, then the Quick Batch Edit modal opens for that product.
- [ ] Given the user is on Inventory, when they swipe a row left past a small threshold, then a compact "•••" action affordance is revealed behind the row; tapping it opens the same Quick Batch Edit modal. Only one row's action affordance is open at a time — opening another row's, or tapping elsewhere, closes it.
- [ ] Given a row was just held or swiped, when that gesture ends, then the row's normal tap-to-expand click is suppressed for it — triggering the modal (or revealing the swipe affordance) never also toggles the row's expand state.
- [ ] Given the modal is open, when it renders, then it shows the product's `short_description`, its current total quantity (large and prominent — the same total already on the list row), a `FreshnessBadge` for its rolled-up status, and its batch count.
- [ ] Given the modal is open, when the user taps a stepper (`−10 −5 −1 +1 +5 +10`), then it adjusts a **pending target value** — nothing is written to storage yet.
- [ ] Given the user taps directly on the displayed total, when it turns into an input, then typing a number and committing it (Enter or blur) sets the same pending target value the steppers use.
- [ ] Given the pending target differs from the currently stored total, when the modal renders, then a live delta chip shows the difference — green "+n pending" for an increase, red "−n pending" for a decrease.
- [ ] Given a stepper tap or typed value would take the pending target below 0, when applied, then it's clamped at 0 instead — the pending target can never go negative.
- [ ] Given the pending delta is positive and `Product.does_expire` is `true`, when the modal renders, then an "Expires on" date field appears and is required before Save — same hard-validation rule as Product Add (quantity > 0 + does_expire + no `expires_on` is a hard error, not a soft warning). Given the product doesn't expire, an explanatory line appears instead of the date field. Given the pending delta is zero or negative, a "no new batch" line appears instead — no expiry input for a decrease.
- [ ] Given the user taps **Reset**, when pressed, then the pending target reverts to the originally-stored total and any entered expiry date clears. Reset and Save are both disabled whenever the pending delta is exactly 0.
- [ ] Given the user taps **Save** with a positive pending delta, when the save completes, then one new `Batch` is created for that product with quantity equal to the delta and the entered expiration (or `null` if the product doesn't expire) — appearing immediately in Inventory, the same as a batch added via Product Add.
- [ ] Given the user taps **Save** with a negative pending delta, when the save completes, then that quantity is subtracted starting from the **soonest-expiring batch**, cascading into the next-soonest as needed; any batch emptied to 0 is marked **consumed** (`specs/Prices & Product Differentiation.md`) rather than removed — same visible result (it's gone from Inventory/this modal's count), the row just persists server-side instead of being deleted. This assumes the user is consuming what expires soonest — if that assumption is wrong for a particular case, the user is expected to correct it on `Stock Edit.md`'s view, not here.
- [ ] Given the modal is open, when the user taps the "Stock" button, then it navigates to the Stock Edit view for this product (`Stock Edit.md`) — no longer stubbed as of that spec landing.
- [ ] Given the modal is open, when the user taps the product-edit button, then it navigates to the Product Edit view for this product (`Product Edit.md`) — no longer stubbed as of that spec landing.

## Data

This feature only creates/mutates ordinary `Batch` records using the shape defined in `Inventory.md`, extended by `specs/Prices & Product Differentiation.md` with `barcode_id`/`price`/`consumed` (see that spec's Data section — not redefined here). The stepper/type-to-edit/delta-chip interaction is local UI state only (a "pending target" held in the modal); nothing is written until Save, at which point only the net delta between the pending target and the stored total matters:

- **A negative net delta** (Save) reuses the sort `enrichProduct` already computes (`apps/web/src/lib/inventory.ts`): batches sorted by `expires_on` ascending, with `null` (does-not-expire) batches sorting last. Subtracting "from the soonest-expiring batch first" means walking that same array from the front — no new sort key needed. A batch reaching 0 this way is marked consumed via `PATCH /products/:id/batches/:batchId` (`specs/Prices & Product Differentiation.md`), not deleted.
- **A positive net delta** (Save) creates one new `Batch` (`id`, `product_id`, `quantity`, `expires_on`, and now optionally `price`/`barcode_id`) via `POST /products/:id/batches` — structurally identical to what Product Add's manual-entry save path already produces, plus the two new optional fields. It is not a special case of an existing batch; each purchase/lot is its own record, same rationale as everywhere else in this data model (see `Inventory.md`'s Data section). The intermediate stepper taps that got the user to that final number don't each create their own record — only the net result at Save does.

## UI requirements

- **Triggers** (two, both open the same modal):
  - **Hold**: pointer down → ~480ms threshold timer, canceled on early release or movement past a small threshold (see the long-press discussion in this project's history for the general approach). Applies to the whole row, since the product icon this was originally scoped to is deferred (`specs/BACKLOG.md`).
  - **Swipe left**: past a ~40px threshold, latches open a compact "•••" action affordance behind the row; tapping it opens the modal. Only one row's affordance is open at a time.
  - Either gesture suppresses that row's normal tap-to-expand click for the interaction that triggered it.
- **Modal**: reuse `Modal`/`ModalHeader`/`ModalBody`/`ModalFooter`/`Button`/`Input`/`FreshnessBadge` from `shelf-sense-ds`, the same components Add Product's modals use, for visual consistency.
- **Content**:
  - Product `short_description` as the modal title.
  - A stock summary: current total quantity (large, mono), `FreshnessBadge`, batch count.
  - The total is **click-to-edit**: clicking it swaps in a numeric input for typing an exact target quantity (Enter/blur commits).
  - A live delta chip next to the total — green "+n pending" / red "−n pending" — whenever the pending target differs from the stored total; hidden at zero delta.
  - A stepper row: `−10 −5 −1 +1 +5 +10`, all adjusting the same pending target. Decreases clamp at 0.
  - Conditional expiry area, keyed to the pending delta's sign: a required "Expires on" date field when positive and the product expires (mirrors the conditional-field pattern already built in `AddProductModals.tsx`'s manual form); an explanatory line when positive and the product doesn't expire; a "no new batch" line when zero or negative.
  - When the pending delta is positive, an optional price `Input` alongside the expiry area (`specs/Prices & Product Differentiation.md`), plus — only when the product has more than one linked barcode — a `Select` to choose which code this purchase is for (auto-assigned when there's exactly one, omitted when there are zero).
  - A "Stock" button (disabled/stubbed) for the future batches-detail view.
  - A product-edit button, linking to `Product Edit.md`'s view — no longer stubbed.
  - Footer: **Reset** (ghost — restores the original total, clears any entered expiry date) / **Cancel** / **Save**. Reset and Save are both disabled when the pending delta is 0.

## Non-functional

- **Validation**: `does_expire = true` + increase amount > 0 + no `expires_on` is a hard validation error, not a soft warning — same rule as Product Add.md.
- **Absolute quantities only**: no percentage-based updates. A "%" of an unknown pack size isn't a real number — e.g. reducing a 40-unit pack of toilet paper by "50%" stores a meaningless value once the user later buys a differently-sized pack. Every change here is a whole-unit count.
- **Data source**: was `apps/web`'s in-memory mock/local state only, as originally written here — `specs/Prices & Product Differentiation.md` is what finally wires this modal's Save to real `apps/api` batch-mutation endpoints (none existed before it).

## Out of scope

- **Editing individual batches directly** (fixing a wrong quantity/date, removing a mistaken entry, logging a new one outside this modal's delta flow) — covered by `Stock Edit.md`, linked via the "Stock" button above.
- **Any percentage/fractional quantity updates** — deliberately dropped; see Non-functional.
- **Undo or history** of quick edits made here.
