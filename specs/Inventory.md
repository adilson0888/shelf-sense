# Inventory

**Status:** in-progress — UI built in `apps/web` against the approved design, now reading from a real `apps/api` (`GET /products`, Postgres via Drizzle — see `specs/Persistence.md`) instead of mock data. (Renamed 2026-08-13 from `Product List.md` — this screen is what's physically on the shelf, not a general product catalog, so it's now scoped and named accordingly; see the zero-quantity acceptance criterion and the note at the end of UI requirements. A separately specced, differently-scoped **Product List** screen and a new **Grocery List** screen are planned to cover what this rename removes.)

## User story

As someone tracking what's in their pantry, I want to see what I actually have on the shelf at a glance — grouped by generic product regardless of brand or package size — with a clear signal for what's expiring soonest, so that I can use things up before they spoil and see what's running low.

## Acceptance criteria

- [ ] Given a product's total quantity across all its batches is 0 — including a product with no batches at all — when the list renders, then that product does not appear at all (see the note at the end of UI requirements for where it's expected to surface instead).
- [ ] Given two batches of the same product exist (e.g. one 150g pack, one 200g pack of "queijo ralado"), when the list renders, then they appear as one product row with quantity summed across both batches.
- [ ] Given a product has multiple batches with different `expires_on` values, when the list renders that row's freshness badge, then it reflects the **soonest-expiring** batch, not any other.
- [ ] Given a batch has `expires_on = null` (does not expire), when computing that product's freshness badge, then that batch is excluded from the calculation — a product whose batches are all non-expiring shows no freshness warning.
- [ ] Given a product row, when the user taps/expands it, then each batch is shown individually with its own quantity and expiration (or "Does not expire") — and its own freshness badge, since sibling batches of the same product can have different statuses.
- [ ] Given the soonest-expiring batch of a product is **more than `freshness_threshold_days`** away, when the list renders, then the row shows `fresh`.
- [ ] Given the soonest-expiring batch is **within `freshness_threshold_days`**, when the list renders, then the row shows `expiring-soon`.
- [ ] Given the soonest-expiring batch's date has passed, when the list renders, then the row shows `expired`.
- [ ] Given the user searches for "Parmesão ralado" and that string is a registered alias of the product "Queijo ralado", when results render, then "Queijo ralado" appears in the results.
- [ ] Given sort is on its default (**Soonest**), when the list renders, then products are grouped under sticky section headers — Expired / Expiring soon / Fresh / No expiry, in that order — each sorted by soonest-expiring batch then name; empty groups are hidden.
- [ ] Given the user switches sort to **A–Z**, when the list renders, then grouping is dropped in favor of one flat alphabetical list.
- [ ] Given a product's total quantity is below `minimal_quantity` (or the global default when unset), when the list renders, then that row shows a "LOW" indicator.
- [ ] Given the user activates the **Attention** scope tile, when the list renders, then only products with `expired` or `expiring-soon` status are shown; activating it again while already active returns to **All items**.
- [ ] Given the user activates the **Low stock** scope tile, when the list renders, then only products below their low-stock threshold are shown; same toggle-off behavior as Attention.
- [ ] Given the user has opened the list at least once before, when they reopen it with no connectivity, then the previously loaded products/batches still render from local cache.

## Data

Two entities — a **Product** is a generic identity; a **Batch** is one physical purchase/lot of that product, which is where quantity and expiration actually live (this is what makes "1 unit expiring Aug 15, 2 units expiring Sep 20" trackable under a single product, even though they're the same generic item).

```ts
interface Product {
  id: string;
  short_description: string; // generic/canonical name — drives identity, search, and display. e.g. "Queijo Ralado"
  long_description: string; // more detail, still generic/brand-free — e.g. "Queijo Parmesão ralado em saquinho"
  aliases: string[]; // alternate names that resolve to this product (e.g. "Parmesão ralado")
  freshness_threshold_days: number | null; // per-product override of the "expiring soon" window; null = follow the global preference
  minimal_quantity: number | null; // per-product low-stock threshold; null = follow the global preference (same fallback pattern)
}

interface Batch {
  id: string;
  product_id: string;
  quantity: number; // unit count — always a real number, even after a % update (see Non-functional)
  expires_on: string | null; // date-only ISO 8601 ("YYYY-MM-DD"); null = does not expire
}

type FreshnessStatus = "fresh" | "expiring-soon" | "expired" | "no-expiration";
```

`aliases` is populated by a different, future spec (product addition — see Out of scope); Inventory only *reads* it for search matching. Both descriptions live on `Product`, not `Batch` — brand and size stay out of the model entirely, at every level, per your note. A `Batch` is purely "how much, expiring when" — it exists only to keep different purchases' expiration dates separate, nothing else varies per batch. `Product.icon` is deferred — see `specs/BACKLOG.md`.

## UI requirements

Implemented in `apps/web` (`src/pages/Inventory.tsx`) against the approved Claude Design prototype (`templates/product-list-alt/ProductListAlt.approved.dc.html`, "Product List — Triage", approved 2026-08-11). That design superseded most of what this section used to say — the differences are called out below rather than silently absorbed.

- **Dark theme by default** on this screen (per the design's own implementation notes — a theme switcher exists but lives in the main menu, not here).
- **Header**: "Pantry" eyebrow label + "Inventory" title, a "+ Add" button (wired to the future `Product Add` flow), and a search box matching against `short_description` and `aliases`.
- **Zero-quantity products are excluded entirely** — a product whose total quantity across all its batches is 0 (including one saved with no batch at all, e.g. via `Product Add`'s quantity-left-blank path) does not render, is not counted in any scope tile, and is not reachable via search on this screen. This is this feature's defining scope: Inventory shows what's on the shelf, not everything the user has ever added.
- **Scope tiles** (three, side by side, each showing a live count): **All items**, **Attention** (`expired` or `expiring-soon`), **Low stock** (below `minimal_quantity`). Tapping Attention/Low toggles it on; tapping again returns to All items. This *replaces* the old "minimum quantity filter" idea — there's no free-typed numeric filter, just the fixed per-product `minimal_quantity` threshold driving a toggle.
- **Sort**: a two-way **Soonest / A–Z** control. **Soonest is the default** (not alphabetical, which is what this section previously said) — it groups products under sticky section headers (Expired / Expiring soon / Fresh / No expiry), each internally sorted by soonest-expiring batch then name. A–Z drops grouping for one flat alphabetical list.
- **Product row**: `short_description`, a "LOW" badge when applicable, a meta line (batch count + relative expiry phrasing, e.g. "Expires in 3 days" / "Best before Aug 20, 2026"), total quantity, a `FreshnessBadge` for the row's rolled-up status, and a chevron to expand.
- **Row expand**: reveals each `Batch` — quantity and `expires_on` (or "Does not expire") — **each with its own `FreshnessBadge`**, since sibling batches of the same product can have different statuses (this is the whole point of the Product/Batch split — don't collapse it away in the expanded view).
- **Empty state**: no products yet, or nothing matches the current search/scope — copy and call-to-action differ between the two cases.
- **Product icons**: out of scope for this phase — see `specs/BACKLOG.md`.
- **Gap to resolve**: the approved design drops the "i" detail affordance for `long_description` that this section used to call for — it didn't survive into what got approved and built. Flag whether that's intentional (maybe deferred to a later visual pass) or should be added back; as built, this screen doesn't show it.
- **Components**: `Button`, `Input`, `FreshnessBadge` from `shelf-sense-ds` (all exist and are synced) — layout is custom Tailwind, not `DataTable` (a row-grouped list doesn't fit a table shape well). Mobile still has no `shelf-sense-ds` equivalent to draw from (web-only package) and needs native RN components built fresh when this screen's mobile version happens.
- **Open gap, not resolved by this spec**: once a product's quantity reaches 0, it disappears from here with no replacement surface yet — no screen currently shows "products I'm out of." `specs/Product List.md` (full catalog, now written and built) covers half of that gap; a new **Grocery List** (surfaces what's missing) still isn't specced. Until that lands, a 0-qty product with nothing else pointing at it is only found via Product List, not from here. See `specs/BACKLOG.md`.
- **Footer bar**: same `border-t border-border bg-surface-0` treatment `Product List.md`/`Product Edit.md` use for their bottom bar, matched to Product Edit's actual rendered height (`h-16`, not `py-md` alone — see `Product List.md`'s own note on why). Empty here too — nothing on this page to commit.

## Non-functional

- **Offline caching**: mobile already has SQLite (`apps/mobile/src/db.ts` precedent); web needs an equivalent local cache (IndexedDB/localStorage) so "load from cache after first load" behaves consistently on both platforms. Exact sync strategy (what happens to edits made offline) is bigger than this spec — see the earlier note about writing a dedicated offline-sync spec before too many features depend on it.
- **Freshness threshold**: `expiring-soon` = soonest batch within `Product.freshness_threshold_days`; `fresh` = further out than that. Per-product, defaulting to a global user preference (7 days until that preference screen exists) when not explicitly set — see `Product Add.md`'s Data section for the field. A product's threshold is read live at render time, not frozen at add time, so changing the global preference later re-flows every product that hasn't been individually overridden.
- **Low-stock threshold**: same fallback pattern as freshness — `minimal_quantity` per product, global default of **3** until a preferences feature exists.
- **Data source**: `apps/web` currently renders fixed mock data (`src/mocks/products.ts`) with dates computed relative to "now" rather than pinned — there is no real `apps/api` endpoint yet. Wiring to a real backend is a follow-up, not covered here.

## Out of scope

- **Adding a product** — barcode scanning, external product-database lookup, the alias-suggestion-and-accept flow, manual alias management. Explicitly a separate future spec per this conversation; Inventory only *displays and searches* what's currently in stock.
- **A full product catalog / "products I'm out of" view** — deliberately not this screen's job; see the "Open gap" note in UI requirements and `specs/BACKLOG.md`.
- **Updating/consuming stock** (increasing or decreasing quantity) — a mutation flow distinct from listing/viewing; covered by `Quick Batch Edit.md`. Quantity changes there are always absolute unit counts, never a percentage (a % of an unknown pack size isn't a real number — see that spec's Non-functional section).
- **Product categories** — explicitly ruled out.
- **Category-based freshness thresholds** — still ruled out; the override is per-product, not per-category.
- **Unit of measure / weight-volume tracking** — everything is a unit count; no grams, liters, etc.
- **Brand tracking** — deliberately not modeled; different brands of the same generic product are indistinguishable in this system.
