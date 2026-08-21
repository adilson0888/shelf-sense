# Relative Tracking

**Status:** done

## User story

As someone tracking pantry stock, I want to track select products — large-volume liquids bought as a single container, with no meaningful expiry date — by overall remaining percentage rather than unit count, so that I get a useful low-stock signal ("20% left") instead of a meaningless "1 unit" that never changes until the whole container is gone.

## Acceptance criteria

- [ ] Given the user is adding a new product, when they choose to track it **as %** instead of units, then `does_expire` is forced off and its toggle is hidden/disabled — a %-tracked product never has an expiry, no exceptions.
- [ ] Given `tracking_mode` is chosen at creation (**units** or **percentage**), when the product is saved, then it can never be changed afterward — Product Edit shows it read-only, not as an editable field. Switching a product between unit-batches and a single % value is a data migration this spec deliberately doesn't define.
- [ ] Given the user is adding a new %-tracked product, when the manual form renders, then the `quantity`/`expires_on` fields are replaced by a single "current %" field (0–100, defaulting to 100) — saved directly as `Product.stock_percent`. No `Batch` is created for a %-tracked product, ever, under this spec.
- [ ] Given the user opens Quick Batch Edit for a %-tracked product, when the modal renders, then the unit stepper row (`−10 −5 −1 +1 +5 +10`) is replaced with a percentage stepper row: `−25% −10% −5% +5% +10% +25%`, each adjusting a **pending % target** — same "nothing written until Save" pattern Quick Batch Edit already uses for units.
- [ ] Given a stepper tap or a typed override, when it would take the pending % below 0 or above 100, then it's clamped to that range instead.
- [ ] Given the pending % differs from the stored `stock_percent`, when the modal renders, then a live delta chip shows it — e.g. "−15% pending" — same visual pattern as the existing unit delta chip, just in % instead of count. E.g. a product at 80% with a typed "-15" delta shows a pending value of 65%.
- [ ] Given the modal is open for a %-tracked product, when it renders, then the expiry area is omitted entirely — no "Expires on" field, no "product doesn't expire" line, no "no new batch" line. None of that applies here since `does_expire` is always off and no batch is ever created.
- [ ] Given the user taps **Save** on a %-tracked product's Quick Batch Edit, when the save completes, then `Product.stock_percent` is overwritten with the pending value directly — no `Batch` is modified or cascaded through (there's nothing to cascade across; unlike units, there's exactly one number). Whether a new `Batch` is also *created* alongside that write now depends on whether a price was entered — resolved by `specs/Price History for % tracked products.md`, not this spec.
- [ ] Given a product's `stock_percent` is at or below its low-stock threshold (see Data), when Inventory/Product List render, then the same "LOW" indicator already used for unit-tracked products appears.
- [ ] Given a %-tracked product, when Quick Batch Edit's "Stock" button renders, then it is disabled — there is no per-batch table to show for this tracking mode (see Out of scope).
- [ ] Given the user opens Settings' Default Options, when it renders, then a "Default minimum %" field (integer, 0–100) is shown alongside the existing default minimal quantity/freshness fields, and saving it updates `preferences.default_minimal_percentage` — the same global-default-with-per-product-override pattern `Settings.md` already establishes for `default_minimal_quantity`/`default_freshness_threshold_days`.

## Data

Extends `Product` (`Inventory.md`, `Product Add.md`) with two new fields; `Batch` is unchanged and is simply never created for a %-tracked product:

```ts
interface Product {
  // ...id, short_description, long_description, does_expire, etc. (see Inventory.md / Product Add.md — unchanged)

  tracking_mode: "units" | "percentage"; // required, defaults to "units". Fixed at creation — never edited afterward (Product Edit shows it read-only).
  stock_percent: number | null; // 0-100, integer. Meaningful only when tracking_mode === "percentage"; null when tracking_mode === "units".
  minimal_percentage: number | null; // per-product low-stock threshold in %, meaningful only for percentage-tracked products; null = follow the global default — same fallback pattern minimal_quantity already uses.
}
```

`does_expire` is forced `false` whenever `tracking_mode === "percentage"` — enforced in the UI (Product Add's toggle hidden/disabled) and should be enforced as a real constraint once a backend exists, not just a UI convention.

`preferences` gains `default_minimal_percentage` (integer, 0–100, defaults to **20**, matching this spec's own motivating example) — a real user-editable field via Settings' Default Options (`Settings.md`), the same role `default_minimal_quantity`/`default_freshness_threshold_days` already play there, not just a hardcoded fallback.

~~**Deliberately deferred**: the original draft of this spec described "adding a new batch" to a %-tracked product as a way to track price over time... Until that's designed, %-tracked products have no `Batch` records at all — `stock_percent` is simply overwritten in place.~~ — resolved by `specs/Price History for % tracked products.md`: a %-tracked product now gets a `Batch` created alongside its `stock_percent` write, but only when the user enters a price on a positive delta; `stock_percent` stays the sole source of truth for current stock either way, and a `Batch`-less %-tracked product (never topped up with a price) remains a valid, unremarkable state.

## UI requirements

- **Product Add**: a tracking-mode choice (units / %) on the manual form. Choosing % hides/disables the `does_expire` toggle (forced off) and swaps `quantity` + `expires_on` for a single "current %" input (0–100, default 100). No batch is created — the value writes straight to `Product.stock_percent`.
- **Product Edit**: `tracking_mode` displayed as plain read-only text, not an input — consistent with "fixed at creation."
- **Quick Batch Edit**: for a %-tracked product —
  - The total display shows `stock_percent` as "65%" instead of a unit count.
  - Stepper row: `−25% −10% −5% +5% +10% +25%`, all adjusting the pending % (clamped 0–100).
  - Click-to-edit total still works, but commits a typed absolute % (0–100) rather than a unit count.
  - Delta chip shows the pending change in %.
  - No expiry section at all (see Acceptance criteria).
  - "Stock" button disabled (see Out of scope).
  - An optional price field (and barcode picker, when applicable) appears when the pending delta is positive, and Save conditionally creates a `Batch` alongside the `stock_percent` write when a price was entered — `specs/Price History for % tracked products.md`, not this spec's original scope.
  - Save writes `stock_percent` directly; Reset reverts the pending value to what was stored, same as today.
- **Inventory / Product List rows**: show `stock_percent` ("65%") in place of the unit-count total. No `FreshnessBadge` variation applies beyond what non-expiring products already get today — a %-tracked product always falls in the existing "No expiry" grouping, same as any other `does_expire: false` product.
- **Settings' Default Options** (`Settings.md`): a "Default minimum %" number input (0–100) alongside the existing default minimal quantity/freshness threshold fields, bound to `preferences.default_minimal_percentage`.

## Non-functional

- **Validation**: `stock_percent` is always clamped to the integer range [0, 100], both on initial creation and every Quick Batch Edit save.
- **This spec amends two existing specs**, since they currently rule this out entirely — both need an explicit percentage carve-out added when this ships:
  - `Quick Batch Edit.md`'s Non-functional section ("Absolute quantities only... no percentage-based updates") and its Out of scope entry repeating that.
  - `Inventory.md`'s Out of scope ("Quantity changes... always absolute unit counts, never a percentage").
- **Data source**: like every other spec at this stage, operates on `apps/web`'s in-memory mock state — no real `apps/api` wiring yet.

## Out of scope

- ~~**Any per-batch price/cost capture for %-tracked products** — deferred until `specs/BACKLOG.md`'s "Batch cost tracking & consumed-batch history" is actually designed; this spec only covers the % value itself.~~ — resolved by `specs/Price History for % tracked products.md`.
- **Changing a product's `tracking_mode` after creation**, in either direction — no migration path between real batches and a single % value is defined here.
- **A Stock Edit equivalent for %-tracked products** — still out of scope even after `specs/Price History for % tracked products.md` gave %-tracked products real (if symbolic) `Batch` rows: those rows are a deliberately write-once price log, not an editable stock table, and that spec keeps the "Stock" button disabled by design, not just by omission.
- **Category-based or otherwise non-per-product % thresholds** — `minimal_percentage` follows the same per-product/global-default pattern as every other threshold in this system, nothing new.
