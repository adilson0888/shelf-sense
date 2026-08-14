# Product List

**Status:** draft. (Named 2026-08-13 — reuses the name the grouped/stock-triage screen used to have, freed up when that screen was renamed to `specs/Inventory.md`. See that spec's status line and `specs/BACKLOG.md`'s "Where a zero-quantity product surfaces" entry for why: `Inventory.md` only shows products with stock on hand, so this full-catalog screen — plus a still-unspecced Grocery List — exist to cover what that rename excludes.)

## User story

As someone maintaining their pantry setup, I want a flat, filterable list of every product I've ever defined — independent of current stock levels — so that I can review and manage my product catalog (what counts as a staple, what expires, its thresholds) without wading through the Inventory view's stock-triage grouping.

## Acceptance criteria

- [ ] Given the nav drawer, when it renders, then a new item, **Products**, appears alongside Inventory and Settings (see `Menu.md`).
- [ ] Given the user taps **Products**, when the page loads, then it opens as a full page inside `AppShell` (hamburger + title chrome, same as Inventory/Settings) — not a modal, and not the chromeless back-arrow overlay Product Edit/Stock Edit use, since there's no single screen to "go back" to from a drawer destination.
- [ ] Given the page renders, when displaying rows, then every `Product` appears exactly once — one row per product identity, regardless of how many batches it has or whether it has any at all. Unlike Inventory, this list is not grouped by freshness and does not roll up batch data.
- [ ] Given no filter/search is active, when rows are ordered, then they sort alphabetically by `short_description` (locale-aware compare, matching the active app locale). No column-sort or pagination controls in this pass — see Out of scope.
- [ ] Given the search box, when the user types, then it matches against both `short_description` and `aliases` — the same case-insensitive substring match `apps/web/src/lib/inventory.ts`'s existing `matchesSearch` already implements for Inventory (reused, not reimplemented).
- [ ] Given the **Regular/Occasional** filter chips (**All / Regular / Occasional**), when **Regular** is active, then only products whose *effective* `minimal_quantity` (own value, or the global default when `null`) is greater than 0 are shown. When **Occasional** is active, only products with `minimal_quantity` explicitly set to `0` are shown — see Data for why this is a derived split, not a stored field.
- [ ] Given the **Does it expire** filter chips (**All / Expires / Doesn't expire**), when a non-"All" option is active, then rows are filtered by that product's `does_expire` value.
- [ ] Given both filters and the search box are used together, when applied, then they narrow the same result set (AND, not OR) — consistent with how Inventory's scope tiles and search already compose.
- [ ] Given the table renders, when displaying columns, then each row shows: `short_description`, **Does it expire** (Yes/No), **Freshness threshold** (resolved days, or "—" when `does_expire` is false), **Minimum stock** (resolved quantity).
- [ ] Given a product's `freshness_threshold_days`/`minimal_quantity` is `null` (following the global default) rather than an explicit per-product value, when that cell renders, then it's visually marked as inherited (e.g. muted text, no special number formatting) so the user can tell an explicit override from a fallback at a glance.
- [ ] Given the user double-clicks (or double-taps) a row, when triggered, then the existing Quick Batch Edit modal (`Quick Batch Edit.md`) opens for that product — the identical modal Inventory's long-press/swipe already opens, just reached through a new trigger path. No quantity/batch data is shown or editable directly in this table (see Out of scope) — Quick Batch Edit is a shortcut *into* the stock-adjustment flow, not a preview of it.
- [ ] Given a row's **⋯** button, when clicked, then a small popover menu opens with two options: **Edit product** (navigates to `Product Edit.md`'s view for that product) and **Edit stock** (navigates to `/products/:id/stock`, `Stock Edit.md`'s view). Clicking outside the popover or pressing Escape closes it without navigating.
- [ ] Given the **+ Add** button at the top of the page, when clicked, then it opens the same Add Product flow (`Product Add.md`) already wired to Inventory's own "+ Add" button — one shared modal, two entry points.
- [ ] Given the catalog has zero products at all, when the page renders, then an empty state is shown ("No products yet" + an "+ Add" call to action) — distinct copy from the next case.
- [ ] Given the catalog has products but the current search/filter combination matches none of them, when the page renders, then a "No products match" empty state is shown instead of an empty table, with a way to clear filters/search.
- [ ] Given the initial product fetch fails, when that happens, then an `Alert variant="danger"` with a "Try again" retry action is shown — same pattern `Inventory.md`/`Settings.md` already use, not a blank/broken table.

## Data

No new entities or persisted fields. Reuses `Product` exactly as defined in `Inventory.md`/`Product Add.md`/`Product Edit.md`.

**Regular vs. Occasional is derived, not stored** — no new `Product` field. A product is "Occasional" only when `minimal_quantity` is explicitly `0`; every other case (a positive number, or `null` following a non-zero global default) is "Regular". This reuses the existing low-stock-threshold field as the signal rather than adding a parallel boolean that could drift out of sync with it:

```ts
// Derived, display/filter-only — not persisted anywhere.
function isRegular(product: Product, defaultMinimalQuantity: number): boolean {
  return (product.minimal_quantity ?? defaultMinimalQuantity) > 0;
}

function effectiveMinimalQuantity(product: Product, defaultMinimalQuantity: number): number {
  return product.minimal_quantity ?? defaultMinimalQuantity;
}

function effectiveFreshnessThresholdDays(product: Product, defaultFreshnessThresholdDays: number): number | null {
  return product.does_expire ? (product.freshness_threshold_days ?? defaultFreshnessThresholdDays) : null;
}
```

Global defaults come from `apps/web/src/lib/preferencesStore.tsx`'s `PreferencesStore` (`specs/Settings.md`) — the same source `Inventory.tsx` already reads (`usePreferencesStore`, wired for real as of `specs/Settings.md` landing), not a separate hardcoded constant for this page.

## UI requirements

- **Entry point**: new `Products` item in `NavDrawer`'s flat item list (`specs/Menu.md`) — route `/products`, icon `🗂` (distinct from Inventory's `▤`). This is a change to an already-approved nav prototype; needs a quick design-sync pass before it ships, same as any other addition to that item list.
- **Layout**: `AppShell` chrome (hamburger + "Products" title in the top app bar), matching Inventory/Settings — not the chromeless full-viewport overlay pattern `Product Edit.md`/`Stock Edit.md` use for screens drilled into from elsewhere.
- **Header row**: search `Input` (placeholder "Search products or aliases…"), the two filter-chip groups (Regular/Occasional, Does it expire — same toggle-chip visual language as Inventory's scope tiles), and a "+ Add" `Button` reusing `AddProductModals.tsx`.
- **Table**: `shelf-sense-ds`'s existing `DataTable` component — this is the first screen shaped like the row-per-record table it was actually built for (Inventory's grouped/expandable rows deliberately opted out of it). Columns: Short description, Does it expire (`StatusBadge` or plain Yes/No text), Freshness threshold, Minimum stock, and a trailing icon-only column for the **⋯** menu.
- **`DataTable` needs two additions** — it currently only exposes `onRowClick` (single click) and has no built-in cell-level menu:
  - An `onRowDoubleClick` prop, parallel to the existing `onRowClick`.
  - No table-level change needed for the **⋯** menu itself — it's just a column whose `render` returns a trigger button — but that trigger needs a new component (below).
- **New `shelf-sense-ds` component needed**: a small anchored **popover/menu** (trigger button + floating option list, dismiss on outside-click/Escape) — nothing in the current set (`Button`, `Badge`, `StatusBadge`, `FreshnessBadge`, `Card`, `Input`, `Select`, `Alert`, `StatCard`, `DataTable`, `IconButton`, `Modal`, `NavDrawer`, `Switch`) covers this. Build it in `packages/design-system` and sync before this ships to Claude Design, same convention `Product Add.md` followed for its own new-modal need.
- **Inherited-value styling**: cells showing a resolved-from-default number use muted/secondary text color (no badge, no asterisk) — quiet enough not to compete with the actual data, present enough to answer "is this overridden?" at a glance.
- **Empty states**: two distinct cases per Acceptance criteria — zero products ever, vs. zero matches for the current filter/search — same "different copy, different call to action" convention `Inventory.md` already establishes.
- **Product icons**: out of scope for this phase — see `specs/BACKLOG.md`, same as every other product-listing screen.
- Mobile-first, matching every other screen in this app — the table needs its own responsive treatment (horizontal scroll within the table's own container, per this codebase's `overflow-x-auto` convention) rather than reflowing into cards, to keep this a genuinely flat/scannable list.

## Non-functional

- **Data source**: like every other web spec so far, this reads from `apps/web`'s existing product store (`productsStore.tsx`) — no new fetch, this is a different view over data Inventory already loads.
- **Consistency with Inventory's search**: reuses `matchesSearch` from `inventory.ts` rather than a parallel implementation, so search behavior (case sensitivity, alias matching) never drifts between the two screens.
- **Filter chips are pure client-side filtering** over the already-loaded product list — no new API query params, same as Inventory's own scope tiles.
- **Accessibility**: the new popover component needs the same baseline this codebase's `Modal` already has — `role="menu"`/`role="menuitem"` semantics, Escape to close, focus returns to the trigger button on close.

## Out of scope

- **Any batch/quantity display or editing directly in this table** — this screen is product identity/configuration only; stock changes go through Quick Batch Edit (double-click shortcut) or Stock Edit (via the **⋯** menu), never inline here.
- **Column sorting and pagination** — deferred; default alphabetical order is enough while the catalog is small. Revisit once product counts grow (candidate for `specs/BACKLOG.md` if it becomes real).
- **Bulk actions** (multi-select rows, bulk edit/delete) — single-row actions only in this pass.
- **Deleting a product** — not covered by this spec, same boundary `Product Edit.md` already draws for itself.
- **A dedicated "in stock / out of stock" indicator column** — this table is about configured thresholds, not current levels; that's Inventory's job.
- **Product icons** — deferred, see `specs/BACKLOG.md`.
