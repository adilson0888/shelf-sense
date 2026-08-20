# Price History for % tracked products

**Status:** in-progress — built and verified end-to-end against the real running `apps/api`/`apps/web` (real dev DB, real browser session, screenshots): `QuickBatchEditModal`'s price/code fields now render for a percentage-tracked product's positive delta, `Inventory.tsx`'s `quickSave` conditionally calls the real `POST /products/:id/batches`, the API's percentage-tracked block was relaxed to a price-required check, and the "Price History" entry point (row popovers on both Inventory/Product List, and Quick Batch Edit's own button) is no longer disabled for this tracking mode — confirmed rendering a real two-point chart from a percentage-tracked product's logged purchases. Not yet verified: the swipe-revealed "•••" row-action path specifically (only long-press and the popover's own button were exercised), and no automated test suite exists in this repo to pin any of this down going forward.

## User story

As a **user with percentage-tracked products** (large-volume liquids bought as a single container — `specs/Relative Tracking.md`), I want to **optionally record what I paid each time I top the container back up**, so that **I can see its price history over time the same way I already can for unit-tracked products, instead of that data being lost every time the % bar is adjusted**.

## Acceptance criteria

- [ ] Given the user opens Quick Batch Edit for a %-tracked product and the pending % delta is positive, when the modal renders, then an optional price `Input` appears — the same field the unit-tracked flow already shows (`specs/Prices & Product Differentiation.md`) — and, only when the product has more than one linked barcode, a `Select` to choose which code this purchase is for (auto-assigned when there's exactly one, omitted when zero). No expiry field ever appears here — `does_expire` is permanently `false` for a %-tracked product (`Relative Tracking.md`), so there's nothing to ask.
- [ ] Given the pending % delta is zero or negative, when the modal renders, then no price field appears — unchanged from `Relative Tracking.md`'s existing "no new batch" line for a non-positive delta. Nothing about the decrease path changes.
- [ ] Given the pending % delta is positive and the price field is left blank, when the user taps Save, then only `Product.stock_percent` is overwritten with the pending value — exactly as `Relative Tracking.md` already specifies. No `Batch` is created.
- [ ] Given the pending % delta is positive and the user has entered a price, when the user taps Save, then two things happen together: `Product.stock_percent` is overwritten with the pending value (unchanged), **and** one new `Batch` is created for that product — quantity set to the pending %-delta amount (e.g. a +25% top-up creates a `Batch` with `quantity: 25`), `expires_on` always `null`, `price` set to the entered value, `barcode_id` set per the picker (or auto-assigned/`null`, same rule as a unit-tracked purchase), `created_at` auto-set the same as any other `Batch` (`Price History.md`).
- [ ] Given a %-tracked product's Quick Batch Edit "Stock" button, it stays disabled — unchanged from `Relative Tracking.md`. These new `Batch` rows are a write-once price log, not an editable stock table; there's nothing here for a Stock-Edit-shaped view to show.
- [ ] Given a %-tracked product now has one or more of these priced `Batch` rows, when the user opens the "Price History" entry point (row menu, or Quick Batch Edit's own button), then the menu item is enabled — no longer disabled with the "Not tracked for % Off SKUs" tooltip `Price History.md` originally gave it — and the modal renders exactly as it does for a unit-tracked product: one line per barcode plus "General", same chart/legend/stats.
- [ ] Given a %-tracked product has zero priced `Batch` rows (never topped up with a price yet), when Price History is opened, then the existing empty state applies unchanged ("No price data yet...", `Price History.md`).

## Data

No schema change. This reuses `Batch` exactly as `Prices & Product Differentiation.md` and `Price History.md` already defined it — the only thing that changes is *when* a `Batch` gets created for a %-tracked product (previously: never, under any circumstance).

```ts
// Batch — unchanged shape
interface Batch {
  id: string;
  product_id: string;
  quantity: number; // for a %-tracked product's batch, this is the % delta at purchase time (e.g. 25) — a symbolic record, not a real unit count. See Non-functional.
  expires_on: string | null; // always null here — does_expire is permanently false for tracking_mode === "percentage"
  barcode_id: string | null;
  price: number | null; // in practice always set on this spec's new path — a blank price means no Batch is created at all (see Acceptance criteria)
  created_at: string;
}
```

`Product.stock_percent` is written on every Save regardless of whether a `Batch` was also created — this spec doesn't touch that half of `Relative Tracking.md`'s behavior, only adds a conditional side effect alongside it.

## UI requirements

- **`QuickBatchEditModal`** (`apps/web/src/components/`): for a %-tracked product with a positive pending delta, render the same optional price `Input` + conditional barcode `Select` the unit-tracked path already renders (`specs/Prices & Product Differentiation.md`'s UI requirements), positioned the same way — just with no expiry field alongside it, ever. Zero/negative delta: unchanged, no price field, "no new batch" line.
- **Price History entry points** (Product List's "⋯" `Popover`, Inventory's "⋯" `Popover`, Quick Batch Edit's own "Price History" button — all three per `Price History.md`'s UI requirements): the disabled-for-percentage-tracking condition is removed. A %-tracked product's entry behaves identically to a unit-tracked one, including falling into the existing empty state when it happens to have zero priced batches yet — no new "does this product have any priced batches" pre-check needed, the modal's existing empty-state handling already covers that.
- **`PriceHistoryModal`**: no changes needed. It already groups by `barcode_id` and plots price over `created_at`; a %-tracked product's `Batch` rows flow through the same chart/legend/stats logic as a unit-tracked product's, unmodified.

## Non-functional

- **`quantity` is symbolic here, not a real unit count.** For a %-tracked product's `Batch`, it records the % delta at purchase time purely as an honest historical figure — never summed, never surfaced in any UI (Quick Batch Edit's own delta chip already shows the % change live; Price History never displays `quantity` at all), and never drives any total. `Product.stock_percent` remains the single source of truth for current stock, exactly as `Relative Tracking.md` established — nothing here changes how a %-tracked product's total is computed or displayed anywhere (Inventory, Product List, Quick Batch Edit's own total display).
- **These `Batch` rows are write-once and never cascaded or consumed.** Unlike a unit-tracked product's batches, nothing ever subtracts from one of these — a decrease still just lowers `stock_percent` directly, same as today. `consumed` stays `false` forever for a %-tracked product's batch; no mechanism in this spec (or any existing one) ever flips it, and there's deliberately no UI that could.
- **Amends two existing specs**, both of which currently state this can't happen at all:
  - **`Relative Tracking.md`** — its Data section's "Deliberately deferred" paragraph, the Acceptance criterion stating Quick Batch Edit Save "no `Batch` is created, modified, or cascaded through" for a %-tracked product, the matching UI requirements line, and its Out of scope entry ruling out per-batch price capture — all updated to point here.
  - **`Price History.md`** — its Acceptance criterion disabling the "Price History" menu item for `tracking_mode === "percentage"`, and its Out of scope entry describing this exact fix as "a real idea, not resolved here. Tracked in `specs/BACKLOG.md`" — this spec is that resolution; `specs/BACKLOG.md`'s "Percentage-tracked products in Price History" entry is marked resolved pointing here.
- **Validation**: price, when provided, follows the same "non-negative number" rule `Prices & Product Differentiation.md` already applies to every other batch's price. No new validation rule is introduced.
- **Data source**: real, as of this spec — `POST /products/:id/batches` is exercised for a %-tracked product for the first time, verified end-to-end against a real running `apps/api`/database. `Product.stock_percent` itself remains the one exception: it's still written only to `apps/web`'s local state on Save, same pre-existing gap `Relative Tracking.md` already discloses (no `PATCH` endpoint updates it server-side yet) — unaffected by, and out of scope for, this spec.

## Out of scope

- **Enabling the "Stock" button, or any Stock-Edit-shaped editing view, for %-tracked products** — these `Batch` rows are a write-once price log, not an editable stock table (see Acceptance criteria; this was an explicit choice, not an oversight).
- **Editing or deleting a %-tracked product's logged price/batch after creation** — same write-once rule as every other batch's `price`/`barcode_id` (`Prices & Product Differentiation.md`).
- **Any change to how a %-tracked product's current stock/total is computed, stored, or displayed anywhere** — `stock_percent` remains the only thing read for that, unchanged.
- **Backfilling price data for a %-tracked product's past top-ups** — there was never a `Batch` to backfill from; history starts from whenever this spec ships, the same disclosed-gap shape as `Price History.md`'s own `created_at`-migration note.
- **Letting the user later switch a product's `tracking_mode`** — still out of scope per `Relative Tracking.md`, unaffected by this spec.
