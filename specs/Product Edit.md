# Product Edit

**Status:** in-progress — UI built in `apps/web` against the approved design, now saving for real through `apps/api`'s `PATCH /products/:id` (Postgres via Drizzle — see `specs/Persistence.md`). "+ Add barcode"'s scan-first flow (`BarcodeCaptureModal`, `GET /products/lookup-barcode` pre-fill) is implemented and verified via `npm run typecheck`/a real build — see this spec's later Barcodes revision.

## User story

As someone maintaining their pantry inventory, I want to edit a product's own details — its name, description, expiration behavior, and which barcodes point to it — so that I can fix mistakes and keep products accurately identified without re-adding them from scratch.

## Acceptance criteria

- [ ] Given the user is viewing the Quick Batch Edit modal (`Quick Batch Edit.md`), when they tap the product-edit button, then they're taken to the Product Edit view for that product.
- [ ] Given the user instead reaches this view via Product List's "Edit product" **⋯** menu option (`Product List.md`), when it loads, then the identical view renders — a second entry point, no behavioral difference except where Save/Cancel return to (see Save / Cancel below).
- [ ] Given the Product Edit view loads, when it renders, then every field except `id` is directly editable and pre-filled with the product's current values: `short_description`, `does_expire`, `freshness_threshold_days`, `minimal_quantity`, plus a barcodes table and an aliases section (see below). There is no separate read-only "details" view — this editable view is the whole thing. (`long_description` was originally in this list — removed by `specs/Prices & Product Differentiation.md`, which drops the field entirely in favor of the barcodes table's own per-code `description` below.)
- [ ] Given the user changes `short_description` to a value already used by another product, when they attempt to confirm the save, then an inline error is shown naming the conflict and nothing persists.
- [ ] Given the user changes `short_description` to a new, unique value, when the field is edited, then an informational note appears stating the rename applies everywhere this product is referenced — this is a heads-up about blast radius, not a mutation warning: barcodes and batches key off `product_id`, not the name itself, so nothing about them technically changes.

### Aliases ("Also known as")

- [ ] Given the section renders, when aliases exist, then each is shown as a removable pill/chip (label + a small "×" button) rather than a table row — simpler than the barcodes table since an alias is just a string, with no second field to manage per entry.
- [ ] Given the user types a value and taps "Add", when it's free (no other product's `short_description` or `aliases` already claims it), then it's added to the pending alias list immediately — no confirmation needed.
- [ ] Given the user taps a chip's "×", when pressed, then that alias is removed from the pending list immediately — no confirmation needed either, staged like everything else until Save.
- [ ] Given the new alias collides with another product's `aliases`, when checked, then the same conflict-and-confirm "move it here?" flow as barcodes triggers, naming the other product.
- [ ] Given the new alias collides with another product's `short_description` itself (not just one of its aliases), when checked, then it's a hard, non-negotiable error instead — reassigning another product's primary name via an alias isn't offered as a "move."

### Barcodes

- [ ] Given the table renders, when displayed, then each row shows a checkbox, the barcode's `code`, and its `description` — the description is inline-editable (click it, like Quick Batch Edit's click-to-edit total).
- [ ] Given the user clicks "+ Add barcode" and the browser supports `BarcodeDetector` (`isBarcodeScanSupported()`, `specs/Barcode Scanner & Product info scrape.md`), when clicked, then the camera capture screen opens immediately — the same `BarcodeCaptureModal` Add Product uses, not a separate component. This supersedes the original "not a camera scan" reasoning: with `specs/Prices & Product Differentiation.md` now requiring every product to carry at least one code, saving the user from typing a real EAN by hand outweighs the "already-identified product" simplicity argument that justified manual-only entry here.
- [ ] Given the user clicks "+ Add barcode" and the browser does **not** support `BarcodeDetector`, when clicked, then the inline form opens directly — unchanged, this is the pre-existing "not a camera scan" behavior, now reached only via this fallback rather than always.
- [ ] Given a barcode is detected, when decoding completes, then `GET /products/lookup-barcode?code=<code>` runs (same call, same provider pipeline Add Product's scan flow uses) and the inline form opens pre-filled: `code` from the scan, `description` from whatever the lookup found (blank if nothing did, per `specs/Barcode Scanner & Product info scrape.md`'s "partial info still fills the form" rule) — both fields stay editable before the user commits with "Add code," same as a manually-typed entry. A loading state covers the lookup call; canceling out of it (or the capture screen's own "Edit manually") falls through to the blank inline form instead.
- [ ] Given the inline form is open (scan-prefilled or blank/manual), when the user reviews it, then "Add code" stays disabled until description is non-empty and the code has at least 8 digits — unchanged validation, now satisfied automatically by a real scanned code.
- [ ] Given the entered code is not linked to any other product, when submitted, then it's added to this product's pending barcode list immediately — staged only, not yet persisted.
- [ ] Given the entered code **is** linked to another product, when submitted, then the same "Move this barcode?" confirm dialog Product Add already built is shown, naming the other product. Confirming stages the move (added here; marked to unlink from the other product at Save). Declining discards the attempt — no staged change either way.
- [ ] Given the user checks one or more barcode rows and clicks "Remove", when pressed, then they're removed from the pending list immediately — no confirmation dialog. Same reasoning as aliases: the removal is only staged, fully reversible via Cancel, and Save's own confirm-to-commit step is already the one confirmation this edit session needs — a second, earlier confirmation for the same eventual commit would be redundant.

### Save / Cancel

- [ ] Given the user has made zero pending changes (no field edits, no alias/barcode adds/removes/moves), when viewing the bottom bar, then **Save** is disabled. **Cancel** is always enabled.
- [ ] Given the user has pending changes, when they click **Save**, then the button relabels itself to "Confirm?" in a distinct color (`shelf-sense-ds`'s `Button` `variant="confirm"`), with a one-line summary of what's about to be saved shown above it — no new button is added, no other buttons change.
- [ ] Given **Save** is showing "Confirm?", when the user clicks it again, then all pending changes persist together, atomically, as one operation — field edits, alias adds/removes/moves, barcode adds/removes/moves — and the view closes back to whichever page it was opened from (Inventory, Product List, or Grocery List — see the entry-point criteria above and `Grocery List.md`, which reuses the same Quick Batch Edit modal this view is also reached through), not hardcoded to Inventory.
- [ ] Given **Save** is showing "Confirm?", when the user instead edits any field, toggles anything, or changes a table row, then **Save** silently reverts to its normal label — a stale confirm-click never carries over past a change of mind expressed by continuing to edit.
- [ ] Given **Save** is showing "Confirm?", when the user clicks **Cancel** instead, then it behaves exactly as it always does — discards every pending change and returns to the page it was opened from. No separate "back out of confirming" affordance exists; the view's own Cancel already covers it.
- [ ] Given the user clicks **Cancel**, when pressed, then all pending changes are discarded and the app returns to the page it was opened from (Inventory, Product List, or Grocery List), same rule as Save, without persisting anything.

## Data

```ts
interface Barcode {
  id: string;
  code: string; // the scanned/typed value itself
  description: string; // human-readable label for this specific barcode/pack (e.g. "40-pack, big box").
                        // Typed directly in the add-barcode form, or corrected afterward via inline edit —
                        // auto-populating it from a product-lookup tool remains a future enhancement, not
                        // the only way it gets filled in (see Non-functional).
  product_id: string; // the one product this barcode currently belongs to — never linked to two products at once,
                       // same global invariant Product Add.md already established
}

interface Product {
  // ...id, short_description, freshness_threshold_days, minimal_quantity, does_expire
  // (see Inventory.md / Product Add.md — unchanged here)
  // long_description removed by specs/Prices & Product Differentiation.md

  aliases: string[]; // unchanged shape; this spec is the first to give it an editing UI
  barcodes: Barcode[]; // was string[] in Product Add.md/Inventory.md's Data sections — this spec upgrades every
                        // product's barcode list from a raw string array to Barcode records, so each carries its own
                        // description. Ripples into apps/web/src/types.ts and both of those specs' Data sections.
}
```

Everything the user touches on this view — field edits, the barcode table's adds/removes/moves, the alias list's adds/removes/moves — is **local pending state only** until Save is confirmed. Nothing commits until that single Confirm click, at which point it all applies as one atomic operation (`apps/web/src/lib/productEdit.ts`'s `buildSaveResult`):

- A staged barcode/alias **add** with no conflict → a new entry on this product.
- A staged **move** (conflict, confirmed) → the same new entry here, plus removing it from wherever it lived before — tracked as the edit session progresses (`unlinkBarcodesFrom` / `unlinkAliasFrom`), applied to the *other* product(s) only at Save, atomically alongside this product's own write.
- A staged **remove** → deleted from this product's list; never touched any other product's list.
- Field edits (`short_description`, etc.) → written to the `Product` record, with the `short_description` uniqueness check re-validated at Save/Confirm time, not just when the user first typed it.
- Turning `does_expire` off clears `expires_on` on every one of this product's existing batches at Save time, matching the warning shown while editing.

## UI requirements

- **Full-screen view**, reached from Quick Batch Edit's product-edit button or Product List's "Edit product" **⋯** menu option — distinct from Quick Batch Edit's modal, but implemented as a fixed full-viewport overlay component (`apps/web/src/components/ProductEditView.tsx`) rather than a real URL route: `apps/web` now has a client-side router (`react-router-dom`, since `Stock Edit.md`), but this view was never migrated onto it, and doing so wasn't in scope here. A dedicated route (e.g. `/products/:id/edit`) is a reasonable follow-up, not a gap specific to this feature.
- **Return-to-origin needs no new state**: because the overlay is mounted as local component state inside whichever page renders it (`Inventory.tsx`, `ProductList.tsx`, etc. each hold their own `edit`/`setEdit` state and render `<ProductEditView />` conditionally), closing it via Save-confirm or Cancel is just `setEdit(null)` on that same host page — the page underneath was never unmounted, so it's simply revealed again. Unlike `Stock Edit.md`'s real route, no `from` parameter needs to be threaded through Quick Batch Edit or Product List's own navigation into this view for this to work correctly.
- **Field editing**: same inputs/components as Product Add's manual form (`Input`, `Switch` for `does_expire`) — but pre-filled and edited in place, not stepped through a wizard.
- **Aliases**: pill/chip list (rounded-full, `bg-surface-2`, bordered, a small circular "×" button) + a text `Input` and outline `Button` "Add" beneath it. Not a `DataTable` — a plain string list with only add/remove doesn't need one.
- **Barcodes table**: `DataTable`-shaped layout (checkbox column + Description + Code) — a real, if hand-rolled rather than `shelf-sense-ds` `DataTable`, table. Toolbar: a "Remove" button (only shown with ≥1 row checked) and a "+ Add barcode" button that opens `BarcodeCaptureModal` when scanning is supported, or the inline `description` + `code` form directly when it isn't (see Acceptance criteria) — the inline form itself is unchanged either way, just sometimes arrives pre-filled.
- **Barcode add / conflict**: now reuses both — `BarcodeCaptureModal` for the scan step (see Acceptance criteria) and the existing "Move this barcode?" conflict modal, unchanged, whenever the resulting code (scanned or typed) turns out to already belong to another product.
- **Confirm-to-commit Save**: implemented as a new `shelf-sense-ds` `Button` variant, `variant="confirm"` (warning-amber, distinct from `primary`/`danger`) — the first real use of the pattern this spec originally just called for. The same button relabels itself and swaps variant on arm; no second button is spawned. This flavor assumes a persistent "Cancel" already exists in the surrounding UI (it does, in the bottom bar) and doesn't need its own way to back out.

## Non-functional

- **Validation**: `short_description` uniqueness is enforced at Confirm time, same hard-error rule as Product Add.md — re-checked then, not only when first typed, since edits elsewhere on the view could take a while.
- **Barcode description**: collected up front when a barcode is added, either typed directly (unsupported browser, or the user backs out of a scan) or pre-filled from `GET /products/lookup-barcode` after a successful scan — resolved: this was flagged as "a reasonable future enhancement" here and is now real, see Acceptance criteria. Either way it remains inline-editable afterward for correction; a lookup miss/failure leaves it blank exactly like manual entry always has.
- **Connectivity**: the barcode-lookup-by-value call is the one new network dependency this spec gains — a timeout or failure just leaves the description blank (same as `Product Add.md`'s own "falls through cleanly" rule), never a hard error blocking the add. Camera decoding itself is local/offline, same as Add Product's.
- **Atomicity**: Confirm must persist as a single all-or-nothing operation once a real `apps/api` exists — a save that touches this product's fields, several barcode/alias adds/removes/moves shouldn't be able to partially apply.
- **Data source**: like every other web spec so far, this operates on `apps/web`'s in-memory mock state for now — no real `apps/api` wiring yet.
- **Scope boundary with Quick Batch Edit**: this spec never touches `Batch` records or quantities — that's entirely Quick Batch Edit's job. Product Edit is product-identity and barcode/alias management only.

## Out of scope

- **Deleting the entire product** — not covered by this spec; only its fields and barcode/alias links.
- **Editing individual batches** — that's `Stock Edit.md`'s job, linked from Quick Batch Edit's "Stock" button, unaffected by this spec.
- **A dedicated URL route** for this view — implemented as a full-screen overlay within the existing single-page app instead (see UI requirements); real routing (now present elsewhere, per `Stock Edit.md`) is still future work for this particular view, independent of this feature. Notably, this view's return-to-origin behavior doesn't need that route to be correct — see UI requirements.
- **A separate read-only product-details view** — this edit view is the only screen this spec introduces.
