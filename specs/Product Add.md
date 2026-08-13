# Add Product

**Status:** in-progress — UI built in `apps/web` (`src/components/AddProductModals.tsx`, `src/lib/addProduct.ts`); Save now creates a real Product (+ optional Batch) via `apps/api`'s `POST /products` (Postgres via Drizzle — see `specs/Persistence.md`). Scan/photo/match steps are still simulated (`MOCK_BARCODE_MATCH`) — no real barcode-lookup or vision-identify endpoint yet. (This line was stuck at `draft` even after the flow was implemented in `a7b73ae` — corrected 2026-08-12 to match reality.)

## User story

As someone building out their pantry inventory, I want a fast way to add a new product — by scanning its barcode, photographing it, or typing it in — so that ShelfSense can start tracking it without a lot of manual data entry.

## Acceptance criteria

- [ ] Given the user is on the Inventory screen, when they tap "add product", then a choice of three entry methods is shown: barcode/QR scan, photo, or manual.
- [ ] Given the user picks manual entry, when the form opens, then it is blank — no lookup, no prefill.
- [ ] Given a barcode is scanned and it matches a barcode already linked to one of the user's own products, when the match is shown, then the user can either confirm it (proceed straight to entering quantity/`expires_on` for a new batch of that existing product) or say "add as new" (opens the manual form, prefilled from the matched product — see below).
- [ ] Given the user says "add as new" from a match, when the manual form opens, then every field prefills from the matched product **except `short_description`, which is left blank** — `short_description` must be unique, so it can't default to the value of the product it's diverging from.
- [ ] Given the user says "add as new" from a match, when the form opens, then a warning is shown first (not silently, not just an inline note): this barcode is currently linked to `<matched product's short_description>`; continuing will unlink it from that product and link it to the new one instead — a barcode can only ever belong to one product at a time. The user must explicitly confirm before the form opens.
- [ ] Given the user confirms that warning and saves the new product, when the save completes, then the barcode is removed from the old product's `barcodes` and added to the new product's `barcodes` — never present on both, even momentarily as stored data.
- [ ] Given a barcode is scanned and it does **not** match anything the user has added before, when the app looks it up, then it queries an external barcode-lookup service by the barcode value and prefills the manual form with whatever it finds (or opens it blank if the lookup finds nothing).
- [ ] Given a photo is taken, when the app processes it, then it sends the photo to a vision-capable AI call (via `apps/api`) and prefills the manual form with the suggested `short_description`/`long_description`.
- [ ] Given either scan path produced a suggestion, when the user reviews it, then an explicit "this isn't right, edit manually" action is always available, even when the suggestion looks plausible — the user is never stuck with a wrong auto-fill.
- [ ] Given the user is on the manual form (blank or prefilled, from any path), when they save with quantity left blank or `0`, then the `Product` is created with **no batch**, and `expires_on` is never asked. It does **not** appear in Inventory (`specs/Inventory.md` excludes 0-total-quantity products) — where it surfaces instead is an open gap, deferred to the forthcoming Product List / Grocery List specs; see `specs/BACKLOG.md`.
- [ ] Given the user saves with a quantity greater than `0`, when `Product.does_expire` is `true`, then `expires_on` is a required field for that batch; when `does_expire` is `false`, `expires_on` is hidden/disabled entirely.
- [ ] Given the manual form is open, when the user views the `minimal_quantity` field and (if `does_expire`) the freshness threshold field, then each shows the user's current global default (`specs/Settings.md`'s `default_minimal_quantity`/`default_freshness_threshold_days`) as placeholder text — a live preview of what gets saved if the field is left untouched, not a real value the user typed.
- [ ] Given the user leaves `minimal_quantity` blank, when the product is saved, then it is stored as the current `default_minimal_quantity` value — **snapshotted at creation time**, not `null`. If the user later changes the global default in Settings, this product's stored value does not retroactively follow it — same as if the user had typed that number themselves. (This differs from Product Edit, which is unchanged: editing an existing product's `minimal_quantity` back to blank still stores `null`, and that product keeps following the live global default — see `specs/Product Edit.md`.)
- [ ] Given the user leaves the freshness threshold blank **and** `does_expire` is `true`, when the product is saved, then it is stored as the current `default_freshness_threshold_days` value, with the same creation-time-snapshot behavior as `minimal_quantity` above. When `does_expire` is `false`, the field isn't shown at all and `freshness_threshold_days` is stored as `null`, unchanged from before.
- [ ] Given the manual/edit form opens (blank or prefilled, any path), when `does_expire` hasn't been touched yet, then it defaults to the user's global "products expire by default" preference (`specs/Settings.md`, itself defaulting to `true` out of the box) — the user explicitly switches it off/on per product from there, same as before.

## Data

Extends `Product` from `Inventory.md` — same entity, these are the fields this spec adds to it. `Batch` is unchanged.

```ts
interface Product {
  // ...id, short_description, long_description, aliases, freshness_threshold_days
  // (see Inventory.md — unchanged here)
  // ...barcodes (see Product Edit.md for the Barcode entity shape — not redefined here to avoid two specs drifting out of sync)

  does_expire: boolean; // required — always has a value, never null. Defaults to `true` in the UI (most products expire); the user switches it off explicitly for things like toilet paper. Governs whether future batch-add screens require or hide `expires_on` — does not itself change Batch's shape
  minimal_quantity: number | null; // per-product low-stock threshold; null = follow the global preference (same pattern as freshness_threshold_days)
}
```

`short_description` is the **business key** for matching/deduplication (search, alias resolution, "is this the same product") — but `id` stays the actual stored identifier, not `short_description` itself. Editing a product's `short_description` later (out of scope here) shouldn't require rewriting every `Batch`'s foreign key. Confirmed: `short_description` must be **unique across all products**, enforced at save time — not literally the primary key, but the uniqueness constraint that makes it usable as one for matching purposes.

**A barcode can only ever be linked to one product at a time** — the same invariant applies globally, not just within one product's own `barcodes` list. Saving a barcode against a new product implicitly unlinks it from wherever it was linked before (see the acceptance criteria's warning-and-confirm flow); the data layer should enforce this as a real constraint, not just something the UI happens to respect.

**One new `apps/api` capability**, proxying to a third-party AI provider server-side (never call this directly from the client — keeps provider keys off the device and centralizes cost/rate control):

```ts
// POST /products/identify-from-photo
// request: the captured photo
// response:
interface PhotoIdentifyResult {
  short_description?: string;
  long_description?: string;
}
```

`identify-from-photo` calls a vision-capable LLM (e.g. Claude with image input). Barcode-to-product lookup (the no-local-match case) is a second, simpler external call — suggest **Open Food Facts** as a concrete starting point (free, open, no key required for basic lookups), flagged as a suggestion rather than a firm commitment.

## UI requirements

- **Entry point**: "add product" affordance on the Inventory screen (already gestured at in that spec's empty state).
- **Method choice**: a modal/sheet with three options — barcode/QR scan, photo, manual.
- **Barcode scan screen**: reuses the camera-scanning flow already built in `apps/mobile`'s `ScanScreen` — this spec extends it with the match/lookup logic above rather than building scanning from scratch.
- **Photo capture screen**: camera, single shot, sent for identification; loading state while `identify-from-photo` runs.
- **Match review** (barcode-matched-locally case): shows the matched product's `short_description`/`long_description`, with "use this" and "add as new" actions.
- **Unlink warning**: triggered by "add as new" from a match. A confirmation dialog naming the matched product and stating the barcode will move to the new product — not a toast, not an inline hint; the user must actively confirm before the manual form opens. Uses the same new modal/dialog component the method-choice step needs (see below).
- **Manual/edit form** (blank, or prefilled from any path): `short_description` (blank when arriving via "add as new" from a match, prefilled otherwise), `long_description`, `does_expire` toggle (**defaults from the user's global preference**, see below), `minimal_quantity` (optional, placeholder previews the current global default and is what gets saved if left blank), freshness threshold (optional, same placeholder-previews-the-default treatment, shown only when `does_expire` is on), `quantity` (optional), `expires_on` (shown/required only per the acceptance criteria's `does_expire`/quantity rules). Always reachable via an explicit "edit manually" action from either scan path's review step.
- **Product icons**: out of scope for this phase — see `specs/BACKLOG.md`.
- **New `shelf-sense-ds` component needed**: a modal/dialog — nothing in the current component set covers this (`Button`, `Badge`, `StatusBadge`, `FreshnessBadge`, `Card`, `Input`, `Select`, `Alert`, `StatCard`, `DataTable`). Build it in `packages/design-system` and re-sync before this ships to Claude Design.
- Mobile-first (this flow is camera-driven), but the manual-entry path should work on web too.

## Non-functional

- **Connectivity**: barcode-lookup-by-value and photo identification both require connectivity. Local barcode matching (against the user's own previously-added products) works offline. Manual entry always works offline.
- **Cost/latency**: the photo-identification AI call costs money per request and takes a few seconds — it blocks only the review step, not the whole flow.
- **Validation**: `does_expire = true` + quantity > 0 + no `expires_on` is a hard validation error, not a soft warning.

## Out of scope

- **Editing an existing product's own record** (`short_description`, `long_description`, `does_expire`, etc. after creation) — this spec covers creation and adding a batch to an already-matched product only. "Edit" during the add flow means adjusting the new batch being created, not the product's stored identity.
- **A shared/cross-user barcode or product database** — matching is local to the user's own previously-added data only.
- **Manual alias management** (adding/removing aliases outside the add flow) — aliases are populated implicitly by this flow's matching; a dedicated management screen is separate future work.
- **Product icons entirely** (generation, rendering, pending states, regeneration) — deferred; see `specs/BACKLOG.md`.
