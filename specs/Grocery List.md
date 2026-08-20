# Grocery List

**Status:** done

## User story

As someone tracking pantry stock, I want a dedicated screen that surfaces only what I actually need to buy — whether it's running low or something I keep no stock of but have just run out of — so that I can shop from a focused list instead of scanning the whole Inventory for trouble spots.

## Acceptance criteria

- [ ] Given the nav drawer, when it renders, then a new item, **Grocery List**, appears alongside Inventory, Products, and Settings (see `Menu.md`).
- [ ] Given the user opens Grocery List, when it renders, then the search bar, camera button, and the three scope tiles all live inside a collapsible "Search & filters" section — same collapsible pattern `Product List.md` uses, open by default since narrowing the list is this page's primary interaction.
- [ ] Given the user opens Grocery List, when it renders, then three scope tiles are shown — **All**, **Low stock**, **Occasional** — same toggle-tile pattern as Inventory's own scope tiles, each showing a live count.
- [ ] Given the **Low stock** tile is active, when the list renders, then it shows every **Regular** product (see Data — effective `minimal_quantity`/`minimal_percentage` greater than 0) currently below its effective low-stock threshold — units-tracked products by `quantity < effective minimal_quantity`, percentage-tracked products by `stock_percent < effective minimal_percentage`. This is the same computed "LOW" condition Inventory's own "Low stock" scope tile and `FreshnessBadge`-adjacent "LOW" badge already use, just filtered to only that set here instead of shown inline in a bigger list.
- [ ] Given the **Occasional** tile is active, when the list renders, then it shows every **Occasional** product (see Data — effective `minimal_quantity`/`minimal_percentage` explicitly `0`) that is currently at zero stock (`quantity === 0` or `stock_percent === 0`). An Occasional product that still has stock left does not appear here — nothing to buy yet.
- [ ] Given the **All** tile is active (the default), when the list renders, then it shows the union of what **Low stock** and **Occasional** would each show, with no duplicates.
- [ ] Given any tile's result set, when it renders, then each item appears as a row (see UI requirements — superseded from this spec's original "cards" wording once implemented), showing the same information Inventory's own row shows for that product: `short_description`, total quantity (or `stock_percent` for a percentage-tracked product), `FreshnessBadge` where applicable, and batch count with the expand affordance to see individual batches — see UI requirements for the one new case (a zero-batch Occasional item) Inventory never had to render.
- [ ] Given the **All** tile's result set, when it renders, then rows are grouped under sticky **Low stock** / **Occasional** section headers (this screen's own organizing idea — Inventory groups by freshness instead); empty groups are hidden, so activating the **Low stock** or **Occasional** tile alone naturally collapses the list to that one group with no extra logic needed.
- [ ] Given a search bar at the top of the screen, when the user types, then it filters the currently active tile's result set only (by `short_description`/`aliases`, same match as Inventory/Product List) — it does not search the full catalog, since this screen's whole purpose is narrowing an already-short list, not browsing everything.
- [ ] Given a small camera button beside the search bar, when tapped, then the barcode capture flow from `Barcode Scanner & Product info scrape.md` opens — a decoded barcode matching an existing product opens Quick Batch Edit directly for it; a non-matching barcode falls through to that spec's Open Food Facts → Tavily → manual-add pipeline, unchanged. Grocery List adds no new barcode-matching logic of its own; it's a second entry point into the same flow Inventory's own scan-triggered "+ Add" already uses.
- [ ] Given an item's row, when the user taps it (a plain tap, not a hold), then the row expands/collapses to show its individual batches — identical tap-to-expand behavior to an Inventory row.
- [ ] Given the user holds (long-press, ~480ms) an item's row, then the existing Quick Batch Edit modal opens for that product — same gesture/timing as Inventory's row long-press.
- [ ] Given a row was just held, when that hold ends, then the row's normal tap-to-expand is suppressed for that interaction — holding a row never also toggles it expanded, same suppression rule `Quick Batch Edit.md` already specifies for Inventory rows.
- [ ] Given a save in Quick Batch Edit changes a product's quantity/`stock_percent` such that it no longer matches the active tile's condition (e.g. restocked above the low threshold), when the modal closes, then that row is removed from the current tile's list without a page reload.
- [ ] Given the active tile's result set is empty (nothing low, nothing occasional-and-out, or no search match), when the list renders, then an empty state is shown with copy specific to that case — distinct copy for "nothing to buy right now" versus "no matches for your search," same "different copy per empty case" convention `Inventory.md`/`Product List.md` already use.

## Data

No new entities or persisted fields — reuses `Product`/`Batch` exactly as defined in `Inventory.md`, `Product Add.md`, and `Relative Tracking.md`. Everything here is a derived read over data those specs already define.

**Regular vs. Occasional** reuses `Product List.md`'s existing derivation (`isRegular`/`effectiveMinimalQuantity`), extended here to cover percentage-tracked products the same way, since `Product List.md` predates `Relative Tracking.md` landing for real:

```ts
// Derived, display/filter-only — not persisted anywhere.
function isRegular(product: Product, defaults: Preferences): boolean {
  return product.tracking_mode === "percentage"
    ? (product.minimal_percentage ?? defaults.default_minimal_percentage) > 0
    : (product.minimal_quantity ?? defaults.default_minimal_quantity) > 0;
}

function isLow(product: Product, defaults: Preferences): boolean {
  if (!isRegular(product, defaults)) return false; // Occasional products never trigger Low stock
  return product.tracking_mode === "percentage"
    ? (product.stock_percent ?? 0) < (product.minimal_percentage ?? defaults.default_minimal_percentage)
    : currentQuantity(product) < (product.minimal_quantity ?? defaults.default_minimal_quantity);
}

function isOutOfStockOccasional(product: Product, defaults: Preferences): boolean {
  if (isRegular(product, defaults)) return false;
  return product.tracking_mode === "percentage"
    ? (product.stock_percent ?? 0) === 0
    : currentQuantity(product) === 0;
}
```

`currentQuantity` is the same total-across-batches sum `Inventory.tsx`'s `enrichProduct` already computes. Global defaults (`default_minimal_quantity`, `default_minimal_percentage`) come from `PreferencesStore`, same source `Inventory.tsx`/`Product List.md` already read — no separate constant.

Note: Inventory's own `isLow`-equivalent uses a strict `<` for units; `Relative Tracking.md`'s acceptance criteria describe percentage as "at or below" (`<=`). This spec inherits that existing inconsistency between the two rather than resolving it — not something to silently normalize here.

## UI requirements

- **Entry point**: new `Grocery List` item in `NavDrawer`'s flat item list (`Menu.md`) — proposed route `/grocery`, icon `🛒` (distinct from the existing `▤`/`🗂`/`⚙`). Same as `Product List.md`'s own addition, this changes an already-approved nav prototype and needs a design-sync pass before it ships.
- **Layout**: `AppShell` chrome (hamburger + "Grocery List" title), matching Inventory/Products/Settings.
- **Header**: a "Search & filters" `SectionHeader` (collapsible, chevron-toggle — the same shared component `Product List.md` extracted from `Settings.tsx` for its own use), open by default. Collapsed body: search `Input` with the camera `IconButton` anchored to its right (`aria-label="Scan barcode"`), then the three scope tiles (All / Low stock / Occasional) below it, each with a live count — visually the same tile pattern as Inventory's All/Attention/Low stock row. The result-count / "Clear search" line stays outside the collapsible section, always visible, same convention `Product List.md` uses for its own status line.
- **Rows, not cards** — **supersedes** this spec's original "Cards, not rows" decision below. Once built, a boxed `Card` per item looked inconsistent against the rest of the app; this screen instead reuses Inventory's own flush, accent-barred row visual verbatim (left accent bar colored by freshness status, no card border/shadow, full-width tap target) rather than introducing a second list visual language. ~~Cards, not rows: unlike Inventory/Product List's row-based layouts, this screen renders each item as a `Card` (per the original draft's explicit ask) — same content as an Inventory row (`short_description`, quantity/`stock_percent`, `FreshnessBadge`, batch count, expand chevron), just in a card shell instead of a list row.~~
- **Grouped under sticky Low stock / Occasional headers** (All tile only — see Acceptance criteria) — same sticky-header visual as Inventory's own freshness-status groups (dot + label + rule + count), just grouped by this screen's own organizing idea. The **Low stock** and **Occasional** scope tiles don't need their own separate ungrouped layout — filtering to one scope already leaves only one non-empty group, so the same grouped rendering just shows a single header.
- **New case Inventory never had to handle**: an Occasional item at zero stock has no batches to show (that's what makes it zero) — its row renders no `FreshnessBadge` and no expand chevron, since there's nothing to expand, and its accent bar uses a flat danger color rather than a freshness color, since there's no freshness status to color it by. Row still shows `short_description` and "0" clearly, plus a distinct visual treatment (an "Out of stock" tag) rather than reusing the "LOW" badge, since it was never below a threshold — it has no threshold.
- **Row interactions mirror Inventory's exactly**: a plain tap toggles expand/collapse (batches shown inline, same as Inventory's row expand); a long-press (~480ms) opens Quick Batch Edit, unmodified. Swipe-to-reveal (Inventory's third, alternate trigger for the modal) is intentionally **not** included in this pass — tap and hold are the only two gestures a row needs.
- **Components**: `Input`, `IconButton`, `FreshnessBadge`, `Modal` (via Quick Batch Edit) from `shelf-sense-ds` — all already exist. No new component needed; the row/group-header markup is custom Tailwind reused directly from Inventory's own pattern, same as that screen's own approach (not `DataTable` — a row-grouped list doesn't fit a table shape well, per `Inventory.md`'s own note).
- **Footer bar**: `shelf-sense-ds`'s `Footer`, same as Inventory/Products/Settings.
- **Sort within a group**: alphabetical by `short_description` (same default `Product List.md` uses) — grouping (Low stock / Occasional) is the primary organizing axis now, so this is a secondary tiebreaker rather than the open question the original draft flagged it as.

## Non-functional

- **Data source**: reads from `apps/web`'s existing product store — same data Inventory/Product List already load, no new fetch.
- **Consistency**: reuses `matchesSearch`, `enrichProduct`/`currentQuantity`, and the barcode-match pipeline from their existing implementations rather than parallel copies, so behavior never drifts between screens.
- **Accessibility**: camera button carries `aria-label="Scan barcode"`; scope tiles are real buttons with `aria-pressed` reflecting active state, same as Inventory's existing tiles.
- **Menu/design-sync**: adding a fourth drawer item is mechanically free per `Menu.md`'s own "no structural change needed beyond appending to the flat list" criterion, but — like `Product List.md`'s addition before it — still owes a design-sync pass on the `NavDrawer` prototype before shipping.

## Out of scope

- **Adding an arbitrary item to the list** (something not currently low/out, e.g. a one-off shopping reminder) — this screen only ever reflects computed stock state, never a free-form list. A distinct feature if ever wanted.
- **Checking items off / marking "bought" while shopping** — the only way to change a row's presence here is to actually update its stock via Quick Batch Edit; there's no separate "done shopping" checklist state.
- **Swipe-to-reveal gesture on rows** — long-press only, see UI requirements.
- **Reordering or aisle-grouping items** — Low stock/Occasional is the only grouping axis; alphabetical within each group, nothing further.
- **Any new data field** — Regular/Occasional and Low/Out-of-stock are entirely derived from fields `Inventory.md`/`Relative Tracking.md`/`Product List.md` already define.
