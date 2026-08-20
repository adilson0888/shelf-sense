# Backlog

Ideas that are real — we intend to build them eventually — but are deliberately deferred to keep the current spec(s) and implementation lean. Different from a spec's **Out of scope** section: out-of-scope means "not this spec's job, maybe never"; an entry here means "yes, later."

When something's deferred out of a spec, leave a short pointer back to this file rather than deleting the requirement outright. When it's time to pick an entry up, promote it into a real spec via the normal loop (`specs/README.md`) — write/update the target spec's acceptance criteria, data, and UI requirements properly; don't just delete the entry here and start coding from these notes alone.

## Additional Menu sections (Reports, Prices)

Pulled from `Menu.md` (2026-08-12) — the drawer is scoped to Inventory and Settings for now; more sections are expected but not yet designed.

Covers, when picked back up:
- **Reports** and **Prices** as confirmed future sections — exact scope/UI for each is undefined, this is just a placeholder for "these will need a `MenuItem` entry and a real page."
- Re-check at that point whether the flat, ungrouped list in `Menu.md` still holds, or whether the item count justifies grouping/categorizing the drawer.
- **Prices** specifically now has real underlying data to build on: `specs/Prices & Product Differentiation.md` adds `Batch.price` and retains consumed batches as history — this entry is just the browsing/comparison UI on top, still undesigned.

## Batch cost tracking & consumed-batch history — resolved, see `specs/Prices & Product Differentiation.md`.

## Percentage-tracked products in Price History

Pulled from `Price History.md` (2026-08-19) — percentage-tracked products (`specs/Relative Tracking.md`) carry no `Batch` rows at all, so they have no price data and Price History's menu item is simply disabled for them.

Covers, when picked back up:
- Treating a percentage increase (restocking a percentage-tracked product) as a symbolic purchase event — a record with its own timestamp and optional price, even though there's no real batch/quantity behind it — so these products can feed Price History the same way unit-tracked products do.
- Needs a real design pass: where this record lives (a lightweight new entity vs. relaxing `Batch` to allow percentage products a row without a `quantity`), and what UI prompts for the optional price at the moment the user bumps the percentage.

## Locale-correct date input

Pulled from `i18n.md` (2026-08-13) — confirmed empirically while building Quick Batch Edit: the native `<input type="date">` picker's displayed format (`mm/dd/yyyy` vs `dd/mm/yyyy`) is controlled entirely by the visiting browser's own UI language, not the page's `<html lang>` attribute or anything set at the app/JS level (tested both — neither moved it). Every date input in the app today (`Product Add`, `Stock Edit`, `Quick Batch Edit`) inherits whatever format the user's own browser happens to be set to, regardless of the language chosen in Settings.

Covers, when picked back up:
- A custom `shelf-sense-ds` date-picker component, replacing every native `<input type="date">` in the app — needs its own Claude Design prototype pass first per `specs/README.md`'s spec loop (no prototype exists for this control yet).
- Locale-driven calendar rendering (month/day names, week start, `dd/mm` vs `mm/dd` field order) sourced from the same active-locale mechanism `i18n.md` builds (`shelf-sense-i18n`'s `Locale`), not the browser's own language.
- Re-check every existing date-input call site once built: `apps/web/src/components/AddProductModals.tsx` (Expires on), `apps/web/src/pages/StockEdit.tsx` (inline expiration edit + add-batch), `apps/web/src/components/QuickBatchEditModal.tsx` (Expires on).

## Product icons

Pulled from `Inventory.md` (née `Product List.md`) and `Product Add.md` (2026-08-11) — the approved Product List design didn't render an icon anywhere, which prompted deferring the whole feature rather than resolving the mismatch.

Covers, when picked back up:
- **Generation**: on save (any entry path, once `short_description` has a value), an icon-generation request fires in the background; the product appears immediately in a pending-icon state, replaced by the real icon once generation resolves. Doesn't block saving or navigating away.
- **New `apps/api` endpoint**:
  ```ts
  // POST /products/generate-icon
  // request: { short_description: string }
  // response:
  interface IconGenerateResult {
    icon_url: string;
  }
  ```
  Not something Claude does natively — needs an image-generation-capable provider (e.g. OpenAI's image models, Google Imagen); vendor unpinned. The call must apply one consistent, predefined style prompt to every product so icons stay visually coherent across the list.
- **`Product.icon: string` field** (optional, product-level, not per-batch) — back on the `Product` interface in `Inventory.md`/`Product Add.md` when this is picked up.
- **Rendering**: on Inventory rows, and in Product Add's match-review step (alongside the matched product's `short_description`/`long_description`).
- **Pending state UX**: spinner/placeholder treatment while generation is in flight.
- **Icon regeneration** after the fact — not applicable until general product editing exists either (see that same gap noted in `Product Add.md`'s Out of scope).
