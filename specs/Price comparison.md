# Price comparison

**Status:** in-progress — implemented directly against this draft, skipping the usual Claude Design prototyping step (specs/README.md's normal loop) at the user's explicit request.

## User story

As a **user**, I want to check how the sub-products I'm currently looking at in a price chart compare across a handful of shopping sites I trust, so that I can decide where to buy without leaving the app.

## Acceptance criteria

- [ ] Given I'm in Settings, I want a new **"Comparison sites"** section (its own section, after User Preferences) listing sites I want price searches to check.
- [ ] I can add a site by giving it a **label** (e.g. "Mercado Livre") and a **domain** (e.g. `mercadolivre.com.br`) — the domain is what actually restricts the search, the label is just what's shown as that site's column header in results. I can edit and remove existing entries. No minimum or maximum count enforced.
- [ ] Given Price History is open (`specs/Price History.md`), a single **"Search prices"** `Button` appears near the legend (not one button per line). It reuses the legend's existing show/hide toggle as the selection — no separate checkbox UI is introduced. Example: a product "Papel Higiênico" has sub-products Neve, Personal, Primavere; the user unchecks Primavere in the legend, leaving Neve and Personal visible; clicking **Search prices** searches only Neve and Personal.
- [ ] The **"General"** line (purchases with no linked barcode, per Price History's own grouping) is never included in a search even if its legend entry is visible — there's no real barcode to search by. If General is the *only* visible line (every real barcode toggled off), or every line is toggled off, **Search prices** is disabled with a tooltip ("Show at least one product line to compare").
- [ ] Given no comparison sites are configured, or Tavily/AI credentials aren't set in Settings (`specs/Barcode Scanner & Product info scrape.md` already added the Tavily key; AI credentials per `specs/Settings.md`), **Search prices** is disabled with a tooltip explaining what's missing, rather than hidden.
- [ ] Given I click **Search prices**, then a **"Comparing prices…"** loading state appears below the chart (replacing any previous result) while the app searches, for each currently-visible real barcode, all configured sites' domains for that barcode's product + barcode description text (not the bare code — see Data), and extracts a price per barcode/site pair via AI — same "search → AI extraction" pipeline `specs/Barcode Scanner & Product info scrape.md` already established, generalized to a batched barcode × site matrix instead of one product's fields.
- [ ] Given the search resolves, then a **matrix table** replaces the loading state below the chart: one row per searched sub-product (barcode's description, or code if blank — same labeling `specs/Price History.md`'s legend already uses), one column per configured site, each cell either the extracted price or **"Not found"**.

  |                | Mercado Livre | Amazon  |
  | -------------- | ------------- | ------- |
  | Neve           | R$10          | R$11,50 |
  | Personal       | R$9,20        | Not found |
- [ ] Given the search fails outright (network error, Tavily/AI error), then an inline `Alert variant="danger"` with a "Try again" action replaces the loading state — same failure pattern used elsewhere (`specs/Price History.md`'s load-error convention), not a silent blank result.
- [ ] Given I toggle the legend (check/uncheck a line) after a result matrix is already showing, the matrix is **not** auto-updated — it stays as-is until **Search prices** is clicked again, reflecting whatever is visible *at click time*. Nothing is cached or persisted across searches, modal closes, or sessions.
- [ ] Given I close Price History and reopen it, no leftover comparison result is shown — every search starts clean.

## Data

**New table**, `apps/api/src/db/schema.ts` (same shape/conventions as the existing `barcodes`/`productAliases` tables — a flat list, no per-product scoping, single-user per `specs/Persistence.md`):

```ts
export const comparisonSites = pgTable(
  "comparison_sites",
  {
    // No DB-side default — ids are minted in application code
    // (crypto.randomUUID()), same convention as barcodes/productAliases.
    id: uuid("id").primaryKey(),
    label: text("label").notNull(), // shown as the result matrix's column header
    domain: text("domain").notNull(), // e.g. "amazon.com.br" — passed to Tavily's include_domains
    createdAt: timestamp("created_at").notNull().defaultNow(), // display order = insertion order, no manual reordering in v1
  },
  (table) => [uniqueIndex("comparison_sites_domain_unique").on(table.domain)],
);
```

**API**:
- `GET /comparison-sites`, `POST /comparison-sites`, `PATCH /comparison-sites/:id`, `DELETE /comparison-sites/:id` — plain CRUD, same shape as `barcodes`' own endpoints.
- `POST /price-search` — body `{ barcode_ids: string[] }` (the currently-visible real barcodes at click time, "General" never included, per Acceptance criteria). Loads all `comparisonSites`; runs one Tavily search per barcode (query = `${product.short_description} ${barcode.description}`, **not** the bare barcode code — a numeric-only query combined with `include_domains` has almost no recall, confirmed empirically: shopping sites essentially never index a raw EAN as visible page text, unlike `specs/Barcode Scanner & Product info scrape.md`'s own "search the barcode number" fallback, which works because it searches the *open* web with no domain filter; `include_domains` = every saved domain), then **one batched** AI-extraction call (generalized from `apps/api/src/lib/barcodeLookup.ts`'s `extractProductDetails`) across all barcodes' raw results together, returning the full matrix in a single AI round-trip rather than one call per barcode:

```ts
interface PriceSearchRow {
  barcode_id: string;
  label: string; // barcode description, or code if blank — same convention as Price History's legend
  results: {
    site_id: string;
    label: string;
    price: number | null; // null = site was searched but no price could be extracted
  }[]; // one entry per comparisonSite, ordered by comparisonSites.createdAt
}
// response: PriceSearchRow[], ordered to match the barcode_ids request order
```

Nothing from this response is persisted server-side — no new table for results, matching the "don't need to be persisted" requirement.

## UI requirements

- **Settings** (`apps/web/src/pages/Settings.tsx`): new "Comparison sites" section, structurally similar to how `specs/Settings.md` already lists things, with add/edit/remove — likely a small repeating row (label + domain `Input`s, a remove `IconButton`) plus an "Add site" affordance, same list-editing pattern this codebase already uses elsewhere (check for an existing repeating-row pattern in Settings/Advanced Settings before inventing a new one).
- **`PriceHistoryModal`** (`apps/web/src/components/`): a single **Search prices** `Button` placed near the legend (not per-row) — reads the legend's existing visibility `Set`/state as its selection, no new selection UI. Below the chart, a new results area renders one of: nothing (no search run yet this session), loading, the matrix table, or an error `Alert` — per Acceptance criteria. The matrix table is a small `DataTable` (or comparable), sites as columns, searched sub-products as rows.
- Prototype this in Claude Design scoped to the legend's new button and the matrix's states (loading/populated/error) before implementing — `specs/README.md`'s normal loop.

## Non-functional

- **Connectivity**: requires internet, same as any Tavily/AI call elsewhere in this app.
- **Cost/latency**: *N* Tavily calls (one per visible barcode) + **one** batched AI-extraction call per search click — surfaced as its own loading state, not a silent block, matching `specs/Barcode Scanner & Product info scrape.md`'s existing cost/latency convention. Never triggered automatically (e.g. on modal open or on legend toggle) — always an explicit button click, since it costs money and scales with how many lines are visible.
- **Two preconditions, not one**: both a configured Tavily key *and* configured AI credentials are required — raw search snippets aren't usable prices without the AI extraction step, same reasoning `specs/Barcode Scanner & Product info scrape.md` already documents for its own Tavily fallback.
- **No result caching** — a repeated search, even for the same visible set seconds apart, always re-runs live.

## Out of scope

- **Reordering comparison sites** — display order is insertion order only; drag-to-reorder is a future nicety.
- **Auto-refreshing the matrix when the legend selection changes** — the matrix reflects whatever was visible at the moment **Search prices** was last clicked; changing the legend after that requires clicking the button again.
- **Persisting search results** — explicitly a live-only lookup; no history of past comparisons.
- **A general cross-product price-browsing view** — remains `specs/BACKLOG.md`'s existing "Additional Menu sections (Reports, Prices)" placeholder; unrelated to this chart-scoped feature.
- **Currency selection / multi-currency support** — same stance as `specs/Price History.md`.
- **Editing which sites a specific search checks on a per-search basis** — always all configured sites, no per-search subset picker.
