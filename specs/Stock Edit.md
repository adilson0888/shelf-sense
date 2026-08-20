# Stock Edit

**Status:** done

## User story

As someone tracking pantry stock, I want to see and correct every individual batch behind a product's total, so that I can fix a wrong quantity or expiration date, remove a mistaken entry, or log a new purchase — without a small correction requiring a trip through the full Product Edit form.

## Acceptance criteria

- [ ] Given the user taps "Stock" in the Quick Batch Edit modal, when it loads, then they're taken to this product's Stock Edit view at `/products/:id/stock` — no longer stubbed/disabled as of this spec.
- [ ] Given the view renders, when displaying batches, then every batch for this product is listed as a row: quantity, expiration (formatted, or "Does not expire"), and that batch's own `FreshnessBadge` — same per-batch freshness rule already established in `Inventory.md`'s expanded row.
- [ ] Given the table renders, when displayed, then each row has a checkbox for selection.
- [ ] Given the user clicks "+ Add batch", when the inline form opens, then it asks for quantity (required, > 0) and, only when `Product.does_expire` is `true`, an expiration date (required) — same hard-validation rule as `Product Add.md`/`Quick Batch Edit.md`: `does_expire` + quantity > 0 + no `expires_on` is a hard error, not a soft warning.
- [ ] Given the add form is valid and submitted, when added, then a new row appears in the pending list immediately — staged only, not yet persisted.
- [ ] Given the user clicks a row's quantity, when clicked, then it becomes an inline-editable numeric input — same click-to-edit pattern as the barcode description in `Product Edit.md` / the total in `Quick Batch Edit.md`.
- [ ] Given the user clicks a row's expiration date (only present when `Product.does_expire` is `true`), when clicked, then it becomes an inline-editable date input.
- [ ] Given an inline quantity edit reaches 0, when committed, then that row is marked for removal and disappears from the visible table immediately — staged only; nothing is actually deleted until Confirm (see Non-functional for why this is a placeholder behavior, not a settled one).
- [ ] Given the user checks one or more rows and clicks "Remove", when pressed, then they're removed from the pending list immediately — no confirmation dialog, same reasoning as `Product Edit.md`'s barcodes: staged, fully reversible via Cancel.
- [ ] Given the user has made zero pending changes (no adds/edits/removes), when viewing the bottom bar, then Save is disabled; Cancel is always enabled.
- [ ] Given the user has pending changes, when they click Save, then it relabels to "Confirm?" (`shelf-sense-ds`'s `Button` `variant="confirm"`) with a one-line summary of what's about to change (e.g. "2 batches added, 1 updated, 1 removed") shown above it — same confirm-to-commit pattern as `Product Edit.md`, not `Quick Batch Edit.md`'s plain Save (see Non-functional).
- [ ] Given Save is showing "Confirm?", when the user clicks it again, then all pending adds/edits/removes persist together, atomically, and the view returns to Inventory.
- [ ] Given Save is showing "Confirm?", when the user instead edits, adds, or removes anything else, then Save silently reverts to its normal label — same rule as `Product Edit.md`.
- [ ] Given the user clicks Cancel at any point, when pressed, then all pending changes are discarded and the view returns to Inventory without persisting anything.
- [ ] Given a row was added this session (not present when the view opened) or edited (quantity or expiration changed from what it opened with), when the table renders, then that row is visually distinguished from untouched rows — a tinted left-border background plus a small "New"/"Edited" pill — so pending changes are legible before Confirm, not just implied by the summary line.
- [ ] Given every batch has been removed (via Remove or a quantity edit reaching 0), when the table would otherwise render, then an empty state appears instead — "All batches consumed" with an explanation that adding a batch below or saving at zero are both valid — not an empty table with no explanation.

## Data

Reuses `Batch` as defined in `Inventory.md`, extended by `specs/Prices & Product Differentiation.md` with `barcode_id`/`price`/`consumed`:

```ts
interface Batch {
  id: string;
  product_id: string;
  quantity: number; // whole-unit count, no percentages — same rule as Quick Batch Edit.md
  expires_on: string | null; // null = does not expire
  barcode_id: string | null; // specs/Prices & Product Differentiation.md — which linked code this purchase was for
  price: number | null; // specs/Prices & Product Differentiation.md — optional
}
```

Whether the expiration field is shown/required for an add or edit is governed by `Product.does_expire` (established in `Product Add.md`) — it doesn't change `Batch`'s shape, only the UI. Everything the user touches here — adds, inline edits, removes, including a quantity edit reaching 0 — is **local pending state only** until Confirm, same pattern as `Product Edit.md`'s barcode/alias tables.

**Zero-quantity handling**: resolved by `specs/Prices & Product Differentiation.md` — reaching 0 marks the batch `consumed` (persisted via the real `PATCH /products/:id/batches/:batchId` that spec adds) instead of the hard-delete this section originally described. See Non-functional.

## UI requirements

- **Full-screen view**, own header, reached via a **real route**: `/products/:id/stock`. **Not** wrapped in the app's `AppShell` (no hamburger/drawer here) — deliberately consistent with `Product Edit.md`'s existing chrome, applied to both by the same reasoning: a focused edit screen with unsaved pending state shouldn't invite navigating away through the drawer, and `AppShell`'s top-bar title logic (keyed to `Menu.md`'s fixed item list) has no way to represent a per-product route without new work neither page currently needs. **Header structure matches `Product Edit.md`'s exactly**: a "‹" back-to-Inventory control, a "STOCK EDIT" eyebrow label, and the product name — same visual family, different screen.
- **Table**: same hand-rolled, `DataTable`-shaped layout as `Product Edit.md`'s barcode table — checkbox column + Quantity (mono, click-to-edit, "×N") + Expiration (click-to-edit date, or fixed "Does not expire" text when the product doesn't track expiry) + `FreshnessBadge` — not `shelf-sense-ds`'s `DataTable` component, same reasoning as that spec (a row-shaped list with add/edit/remove doesn't fit a generic table shape well).
- **Pending-row treatment**: a new row gets a subtle success-tinted left border + background wash and a small "New" pill; an edited row gets the same treatment in the info color with an "Edited" pill. A row staged for removal doesn't get a visual treatment of its own — it's simply gone from the table immediately (see acceptance criteria), same as barcode/alias removal elsewhere.
- **Empty state** (all batches removed/consumed): a dashed-border card — "All batches consumed" / "No stock left for this product. Add a batch below, or save to leave it at zero." — replaces the table, not just an empty table with a header row.
- **"+ Add batch"** expands into an inline form (quantity, conditionally expiration) below the table, mirroring `Product Edit.md`'s "+ Add barcode" pattern exactly.
- **No conflict/move dialog** — unlike barcodes, a `Batch` is never shared across products, so there's no equivalent of `Product Edit.md`'s "Move this barcode?" case. This is where the barcode-table analogy this spec is modeled on stops applying.
- **Confirm-to-commit Save** (`variant="confirm"`) + **Cancel** in the footer — no separate Reset button. Matches `Product Edit.md`'s overall footer, not `Quick Batch Edit.md`'s per-field Reset (which reverts one pending target, a shape that doesn't map onto a multi-row table of independent adds/edits/removes). **Summary line format**: pending-change categories joined by commas, each only present if non-zero — e.g. "2 batches added, 1 batch updated, 1 batch removed." — singular/plural per count, ending in a period.
- **Components**: `Button`, `Input`, `FreshnessBadge` from `shelf-sense-ds` — no new component needed, same set `Product Edit.md`'s barcode table already uses.

## Non-functional

- **Validation**: `does_expire = true` + quantity > 0 + no `expires_on` is a hard validation error, not a soft warning — same rule as `Product Add.md`/`Quick Batch Edit.md`.
- **Absolute quantities only**: no percentage-based edits, same reasoning as `Quick Batch Edit.md`.
- **Zero-quantity marks a batch consumed, not deleted** (`specs/Prices & Product Differentiation.md`): reaching 0 via inline edit stages that row for removal from this view exactly as before — actually committed only at Confirm, not immediately — but "removal" now means the batch persists server-side with `consumed = true` rather than being hard-deleted. Visually and behaviorally identical to the old hard-delete from this screen's perspective (the row disappears from the table, the empty state still reads "All batches consumed"); the only difference is what happens in the database. `Quick Batch Edit.md`'s equivalent cascading-decrease behavior changes the same way, via the same underlying `apps/api` endpoint.
- **Price**: an optional field on batch creation (`specs/Prices & Product Differentiation.md`) — no format/currency validation beyond "non-negative number."
- **Confirm-to-commit, not plain Save**: chosen deliberately over `Quick Batch Edit.md`'s pattern — the rule going forward is that independent-route, full-screen views (`Product Edit.md`, this spec) use confirm-to-commit, while the quick-adjust modal keeps its own lighter Save/Reset. Not because batch edits are riskier than Product Edit's — they're arguably lower blast radius (no cross-product effects) — but for consistency across same-shaped surfaces.
- **Atomicity**: Confirm must persist as a single all-or-nothing operation once a real `apps/api` exists — same requirement as `Product Edit.md`.
- **Data source**: was `apps/web`'s in-memory mock/local state only, as originally written here — `specs/Prices & Product Differentiation.md` is what finally wires this screen to real `apps/api` batch-mutation endpoints (none existed before it).

## Out of scope

- **Editing product-level fields** (`does_expire`, `short_description`, etc.) — that's `Product Edit.md`'s job, not this one.
- ~~**Batch cost/price tracking, and retaining emptied ("consumed") batches as purchase-history data instead of deleting them**~~ — resolved by `specs/Prices & Product Differentiation.md`.
- **Cross-product batch moves or conflict resolution** — batches aren't shared across products the way barcodes can be, so no "move" flow is needed here, unlike the barcode-table pattern this view is modeled on.
- **Undo or history** of edits made here.
- **Entry points beyond the Quick Batch Edit "Stock" button** — e.g. linking here from Inventory's expanded batch rows — considered, deliberately left for a future pass.
- **Giving Product Edit a real URL route** — still out of scope per `Product Edit.md`; that spec is unaffected by this one beyond now sharing the same confirm-to-commit / no-`AppShell`-chrome pattern.
