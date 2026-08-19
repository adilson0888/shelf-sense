# Price History

**Status:** ready

## User story

As a **user**, I want to **keep track of product prices over time**, so that **I can make better deals based on the products I need to buy**.

## Acceptance criteria

- [ ] Given the user opens the "⋯" row menu on a product — in Product List's existing Edit Product/Edit Stock popover, and in Inventory's row actions (see UI requirements) — when they select **Price History**, a modal opens showing that product's price history.
- [ ] Given the user is in Quick Batch Edit, a **Price History** button (alongside its existing Stock/Edit product buttons) opens the same modal for that product: Quick Batch Edit closes and Price History opens on top, same direction-reversed handoff as Price History's own "Edit batches & pricing" button below.
- [ ] Given the modal is open, it displays a line chart with one line per barcode ("sub-product") the product has, plotting that barcode's price at each purchase over time. Purchases with no linked barcode are grouped into one additional "General" line rather than excluded.
- [ ] Given a purchase (batch) has no recorded price (price was left blank), it contributes no point to the chart — it isn't invented or shown as zero.
- [ ] Below the chart, a legend lists each line's color and label (the barcode's description, or its code if the description is blank; "General" for the no-barcode line). Clicking a legend entry toggles that line's visibility.
- [ ] The chart's Y axis auto-scales to the currently visible dataset — no fixed min/max. It shows 3 labeled ticks (highest/midpoint/lowest of the visible data), each with a light gridline.
- [ ] The chart shows a flat, dashed reference line at the average price across all currently *visible* data points (i.e. it recomputes when a legend entry is toggled) — not a rolling/time-based average. Visually distinct from the 3 gridlines (heavier dash).
- [ ] Hovering (desktop) or tapping (touch) a data point enlarges its dot and shows a small tooltip with that purchase's date and price. Tapping an already-active point clears the tooltip (touch has no hover-away to rely on). Each dot has a larger invisible hit-target around it so it's easy to hit precisely.
- [ ] Above the chart, a small highlight area shows the highest, average, and lowest price ever paid, computed the same visible-set-aware way as the reference line above.
- [ ] By default, when the modal opens, all lines are visible and the chart shows the product's **entire available history** — there is no date-range filter in this version.
- [ ] A toggled-off legend entry dims to reduced opacity with a strikethrough label; its dot in the legend also switches to a neutral (non-color) dot, reinforcing "this line is off" beyond just the chart itself.
- [ ] Given every legend entry is toggled off, the chart area shows a muted "no lines selected" placeholder (not a blank/broken chart) and the stat area is replaced with a single "Toggle a line below to see stats" hint. Legend pills stay clickable to recover from this.
- [ ] At the bottom of the modal, a button labeled **"Edit batches & pricing"** jumps to Quick Batch Edit for that product: it closes Price History and opens Quick Batch Edit, the same way Quick Batch Edit's own "Edit product"/"Stock" buttons already jump to other modals.
- [ ] Given a product tracked by percentage (`tracking_mode === "percentage"`), which carries no `Batch` rows and therefore no price data, the "Price History" menu item is disabled with an explanatory tooltip (e.g. "Not tracked for % Off SKUs") — same treatment Product List already gives "Edit Stock" for these products. See Out of scope for the longer-term fix.
- [ ] Given a product has no priced purchases at all (every batch has a blank price, or the product has no batches), the modal shows an empty state instead of an empty chart — an icon, "No price data yet", and an explanatory line (e.g. "This product has batches on hand, but none were logged with a purchase price yet. Add pricing from Quick Batch Edit to start tracking.").

## Data

Pricing data already accumulates today: every purchase is a `Batch` row with an optional `price`, and consumed batches (quantity reached 0) are retained rather than deleted (`specs/Prices & Product Differentiation.md`). What's missing is a timestamp to plot that price against — `batches` has `expires_on` (a future expiry date) but nothing recording *when* the purchase happened.

**`apps/api/src/db/schema.ts`** — `batches` gains one column:

```ts
createdAt: timestamp("created_at").notNull().defaultNow(),
```

Auto-set at insert, never accepted from a request body, never user-editable — this is a system-recorded instant, not a form field. Existing batch rows are backfilled to this migration's run time (not their real purchase date) when the column is added; every batch that predates the migration will therefore show up at one identical point in time on the chart. Disclosed, accepted limitation — historical accuracy starts going forward from this migration.

**API**: `GET /products/:id/batches?consumed=true` already exists (added ahead of time by `specs/Prices & Product Differentiation.md` for exactly this feature) and, once `created_at` is added to the shared batch-serialization helper, returns it automatically — no new endpoint needed. Combined with the active (non-consumed) batches `GET /products` already returns, that's a product's complete purchase history. Grouping by barcode and computing min/avg/max is done client-side (per-product batch counts are small); no new aggregation endpoint.

```ts
// Batch, as returned by GET /products, POST/PATCH .../batches, and
// GET /products/:id/batches?consumed=true — created_at is the new field.
interface Batch {
  id: string;
  product_id: string;
  quantity: number;
  expires_on: string | null;
  barcode_id: string | null;
  price: number | null;
  created_at: string; // ISO 8601 instant, system-set, never client-writable
}
```

## UI requirements

- **Product List** (`apps/web/src/pages/ProductList.tsx`): add "Price History" as a third item in the existing "⋯" `Popover`/`PopoverItem` (alongside Edit Product/Edit Stock).
- **Inventory** (`apps/web/src/pages/Inventory.tsx`): the "•••" row control is today a single button that opens Quick Batch Edit directly. It becomes a two-item `Popover` (reusing the same `shelf-sense-ds` primitive Product List already uses): **Edit Stock** (identical behavior to today's button) and **Price History**. Long-press on a row is unchanged — it still opens Quick Batch Edit directly, bypassing this menu.
- **`QuickBatchEditModal`** (`apps/web/src/components/`): a new **Price History** button alongside its existing Stock/Edit product buttons. Closes Quick Batch Edit and opens Price History for the same product — the reverse of Price History's own "Edit batches & pricing" handoff, same convention either direction.
- **New `PriceHistoryModal`** (`apps/web/src/components/`), built from the same `Modal`/`ModalHeader`/`ModalTitle`/`ModalBody`/`ModalFooter` primitives every other modal uses, with the line chart, legend, and top stat highlight described in Acceptance criteria. Wider than the codebase's usual `max-w-sm` form-modal width (~`max-w-lg`/520px), since it needs room for a chart — a deliberate, noted exception.
- Prototyped in Claude Design (`templates/price-history/` in the synced `shelf-sense-ds` project) before this build — that prototype is the visual reference for exact spacing, the legend pill treatment, tooltip styling, and empty-state layout; consult it alongside this spec.
- Uses a small charting library (`recharts`) added to `apps/web`'s dependencies — no charting library exists in the repo today, and this covers multi-line series, auto-scaling axes, and a reference line without hand-rolled SVG math.
- No changes to Inventory's or Product List's row rendering beyond the menu itself — price does not surface directly on either list, matching `specs/Prices & Product Differentiation.md`'s existing "price stays out of Inventory and Product List" stance.

## Non-functional

- **No currency code or symbol** — same plain-number convention `specs/Prices & Product Differentiation.md` already established; formatted via `shelf-sense-i18n`'s locale-aware number formatting.
- **`created_at` is never user-editable or client-writable** — enforced at the API boundary (not present in `createBatchSchema`/`updateBatchSchema`), not just hidden in the UI.
- **All computation (grouping by barcode, min/avg/max, visible-set filtering) happens client-side.** Acceptable at this app's scale (a household's purchase history per product); revisit if it ever needs to move server-side.

## Out of scope

- **Date-range filtering / zooming the chart to a window** — v1 always shows full history.
- **Percentage-tracked products having real price history.** They carry no `Batch` rows today, so there's nothing to plot; the menu item is disabled rather than showing a permanently-empty modal. The actual fix — treating a percentage increase as a symbolic restock event with its own timestamp and optional price, feeding this feature the same way a real batch does — is a real idea, not resolved here. Tracked in `specs/BACKLOG.md`.
- **A dedicated "Prices" browsing/comparison view** (comparing prices *across* products, not just one product's own history over time) — remains `specs/BACKLOG.md`'s existing "Additional Menu sections (Reports, Prices)" placeholder.
- **Editing a batch's price or barcode after creation** — unchanged from `specs/Prices & Product Differentiation.md`; still write-once.
- **Currency selection / multi-currency support.**
- **Backfilling accurate purchase dates for pre-existing batches** — see Data's disclosed migration limitation.
