# Prices & Product Differentiation

**Status:** in-progress — schema (`products.longDescription` dropped, `batches` gained `barcode_id`/`price`/`consumed`, `generated_barcode_code_seq`), the long_description-backfill migration, and every `apps/api` route (updated `POST`/`PATCH /products`, new `POST`/`PATCH /products/:id/batches`, `GET /products/:id/batches`) implemented and verified against a real running server. `apps/web` fully wired: Add Product's code/description/"I don't have a code" UI, Product Edit's `long_description` removal, and — the larger piece — Stock Edit and Quick Batch Edit both converted from local-only state to the real batch-mutation API, with price/code-picker fields added to both. Verified end-to-end through the real browser UI: a generated-code product, a Quick-Batch-Edit-created batch with a price, and a cascading consume that correctly marks the emptied batch `consumed` (confirmed excluded from `GET /products`, present via `GET /products/:id/batches?consumed=true`).

## User story

As someone tracking their pantry, I want to keep adding/using products simple day-to-day, but be able to tell apart genuinely different variants of "the same" product (different pack sizes, brands, flavors — all sharing one base name) and optionally record what I paid, so I can tell whether a specific purchase was a good deal or a waste.

## Acceptance criteria

This spec makes a base Product's differentiating detail live on its **barcode(s)** instead of on the product itself, and adds an optional **price** to `Batch`. Both barcode-level descriptions and the `barcodes` table already exist (`specs/Product Edit.md`) — this spec is what finally makes them the *only* place detail text lives, requires at least one at creation, and gives batches somewhere real to persist to (see Non-functional — Stock Edit/Quick Batch Edit don't persist batches to `apps/api` at all today).

- [ ] Given the user opens Add Product, when the form renders, then it asks for a **short description**, **one barcode/code**, and that code's **own description** — all three required. There is no product-level long-form description field anymore; `Product.long_description` is removed.
- [ ] Given the user has no scannable code for what they're adding (a homemade item, something with no printed barcode), when they choose "I don't have a code" instead of typing/scanning one, then the system generates a short, unique code automatically at save time — the user is never asked to invent or remember a stand-in value themselves. (This supersedes the original draft's "EAN must remain optional" — every new product ends up with at least one code, it just isn't always a user-provided one.)
- [ ] Given a system-generated code, when it's assigned, then it's as short as it can be while staying globally unique — a small sequential number, not a UUID or anything the user would need to read or type back. It's stored and behaves exactly like any other barcode (editable/removable in Product Edit, shows in the barcodes table) — there's no separate "generated" flag or distinct code path once created, just a `Barcode` row like any other.
- [ ] Given the entered/scanned code is already linked to another product, when the user attempts to save, then the existing "Link to existing product" / "Move this barcode?" flow (`specs/Product Edit.md`, reused by `specs/Barcode Scanner & Product info scrape.md`) applies unchanged — a code never belongs to two products, even momentarily.
- [ ] Given a product was created before this spec shipped and has zero linked barcodes, when it's viewed/edited, then it keeps working exactly as before — this requirement is Add-Product-forward only, not retroactive. It just can't have a code-level description until it gets a code, same as any other product with zero barcodes today.
- [ ] Given the user is in Product Edit, when they view/add/edit barcodes, then nothing changes — that UI already collects and edits per-code descriptions exactly as needed (`specs/Product Edit.md`'s existing barcode table). Only its `long_description` input is removed from the form.
- [ ] Given the user is adding a batch (Stock Edit or Quick Batch Edit), when the form renders, then it includes an **optional price** field, and — only when the product has more than one linked barcode — a way to pick **which code** this purchase/batch is for. A product with exactly one code auto-assigns it; a product with zero codes (a pre-existing one, see above) simply can't tie the batch to a code, same as price being skippable.
- [ ] Given a batch's quantity is reduced to `0` (Stock Edit or Quick Batch Edit), when that happens, then the batch is marked **consumed** instead of being deleted — it disappears from every active view (Inventory, Product List, Stock Edit's table, Quick Batch Edit) exactly as a deleted batch does today, but the row (and its price, if any) persists for future purchase-history use. This absorbs `specs/BACKLOG.md`'s "Batch cost tracking & consumed-batch history" entry, which flagged exactly this collision and left it explicitly undecided — resolved here.
- [ ] Given a batch is marked consumed, when the user views any active screen, then there is no way to view, edit, or "un-consume" it from this spec — it's retained data, not a feature with its own UI yet (see Out of scope).

## Data

`apps/api/src/db/schema.ts`:

- **`products.longDescription` is dropped.**
- **`batches` gains three columns**:
  ```ts
  barcodeId: uuid("barcode_id").references(() => barcodes.id, { onDelete: "set null" }), // nullable — which code this purchase was for; null for batches on a barcode-less legacy product, or where the user skipped picking one
  price: numeric("price", { precision: 10, scale: 2 }), // nullable — plain number, no currency code/symbol (see Non-functional)
  consumed: boolean("consumed").notNull().default(false), // true once quantity reached 0 through Stock Edit/Quick Batch Edit; replaces the previous hard-delete
  ```

**Migration for existing `long_description` text** (hand-written alongside the `drizzle-kit generate`-produced schema diff, per `specs/Persistence.md`'s documented migration workflow): for every product with a non-empty `long_description`, copy that text onto the `description` of every one of its *existing* barcodes whose own `description` is currently blank — there's no "primary code" to pick just one, so it goes on all of them; duplicate text on sibling codes is expected and editable afterward. Products with zero existing barcodes have nowhere for that text to go under the new model — it's dropped for that specific case, a disclosed, one-time, small-blast-radius loss rather than adding a holding field just for a migration edge case.

**`Barcode`** (`specs/Product Edit.md`) is unchanged — `{ id, code, description, product_id }` already covers everything this spec needs from it.

**System-generated codes**: a dedicated Postgres sequence (`CREATE SEQUENCE generated_barcode_code_seq;`), read via `nextval()` whenever `POST /products` is called without a real code. The result is stored as `code`'s string form as-is — "1", "2", "47", … — no padding, no prefix. Smallest possible by construction (a sequence never repeats and only grows), and short enough (real EAN-8/UPC-A/EAN-13 codes are 8+ digits) that it can never collide with an actual scanned barcode without needing a distinguishing prefix. `barcodes.code`'s existing unique index is the only uniqueness enforcement needed — no collision-retry logic, since a sequence can't hand out the same value twice.

**API surface** (`apps/api/src/routes/products.ts`):

```ts
// POST /products — barcode is now a required object, not an optional scalar.
// long_description removed entirely.
interface CreateProductPayload {
  short_description: string;
  barcode: {
    code: string | null; // null = "I don't have a code" — server generates one (see Data, System-generated codes)
    description: string; // always required, regardless of who/what supplied code
  };
  does_expire: boolean;
  minimal_quantity: number | null;
  freshness_threshold_days: number | null;
  quantity: number; // optional initial batch, unchanged
  expires_on: string | null;
  price: number | null; // NEW — optional, only meaningful when quantity > 0
  tracking_mode: "units" | "percentage";
  stock_percent: number | null;
  minimal_percentage: number | null;
}

// PATCH /products/:id — long_description removed from editProductSchema.
// barcodes: {code, description}[] is unchanged, already covers per-code descriptions.

// GET / — batches in the response are filtered to consumed = false by
// default. This is what actually makes "consumed batches invisible in
// every active view" true: every current consumer (Inventory, Product
// List, Stock Edit, Quick Batch Edit) already treats "the batches array"
// as "current stock" and none of them filter locally today.
```

**New: real batch-mutation endpoints.** Neither exists today — Stock Edit and Quick Batch Edit are local-state only (`apps/web/src/pages/StockEdit.tsx` calls a local `setBatches(...)`, not the API; confirmed `apps/api/src/routes/products.ts` has exactly four routes total, none of them batch-mutation). This spec adds the two real ones both screens need:

```ts
// POST /products/:id/batches — add a batch to an existing product
interface CreateBatchPayload {
  quantity: number; // > 0
  expires_on: string | null; // required iff product.does_expire
  barcode_id: string | null; // must belong to this product if set
  price: number | null;
}

// PATCH /products/:id/batches/:batchId
interface UpdateBatchPayload {
  quantity: number; // reaching 0 sets consumed = true server-side instead of deleting the row
  expires_on?: string | null; // Stock Edit's pre-existing inline expiry edit — omitted leaves it unchanged
}
```

**New: reading a product's consumed batches**, for future purchase-history/Prices UI to have something to query — not built here, but the data needs to be reachable:

```ts
// GET /products/:id/batches?consumed=true
```

## UI requirements

- **Add Product** (`apps/web/src/pages/AddProduct.tsx`): `long_description`'s `Input` is removed. Two new inputs replace it, positioned where `long_description` was: a code field and that code's description (description always required). The code field has an "I don't have a code" toggle/link beside it — choosing it hides/disables the code input and sends `code: null`, letting the system generate one (see Data). When reached via a scan that already resolved a description (Open Food Facts/Tavily, `specs/Barcode Scanner & Product info scrape.md`), that fetched text prefills the code-description field (not a product field anymore) alongside the already-carried `barcode` value, and the toggle is irrelevant since a real code is already in hand.
- **Product Edit** (`apps/web/src/components/ProductEditView.tsx`): remove the `long_description` `Input`. The barcodes table (add/edit/remove/move) is unchanged — it already does exactly what per-code descriptions need.
- **Stock Edit** (`apps/web/src/pages/StockEdit.tsx`) and **Quick Batch Edit** (`apps/web/src/components/QuickBatchEditModal.tsx`): both gain an optional price `Input` (`type="number"`, blank allowed) on batch creation, and — only rendered when `product.barcodes.length > 1` — a `Select` to choose which code the batch is for (auto-assigned silently when there's exactly one, omitted entirely when there are zero). Both switch their zero-quantity path from removing the batch row locally to calling the new `PATCH /products/:id/batches/:batchId` endpoint, which the UI then treats as "gone" (consumed batches are excluded from `GET /`'s response, so no client-side filtering logic needs to change).
- **Inventory / Product List**: no changes. Price does not surface here — see Non-functional.
- No new `shelf-sense-ds` component needed — `Input`, `Select` already cover every new field here.

## Non-functional

- **No currency code or symbol stored or rendered.** `price` is a plain number, formatted with `shelf-sense-i18n`'s existing locale-aware number formatting — no `$`/`R$` prefix. A `default_currency` preference (naturally, `specs/Settings.md`'s Default Options section) is a reasonable small follow-up, not required for this feature to be useful, and explicitly not decided here.
- **Price stays out of Inventory and Product List.** Matches "keep daily use straightforward" from this spec's own user story. `specs/BACKLOG.md`'s "Additional Menu sections (Reports, Prices)" placeholder is the anticipated future home for actually browsing/comparing prices — this spec only makes the underlying data real and queryable, it doesn't build that view.
- **Consumed batches are retained, never hard-deleted, and never editable/reversible from this spec.** A single `consumed: boolean` column, not a status enum or a separate history table — "consumed" is the only state ever asked for (`specs/BACKLOG.md`), and it's the same purchase record, not a different kind of entity.
- **Migration is destructive in one narrow, disclosed case**: a pre-existing product with a non-empty `long_description` and zero barcodes loses that text (see Data). Every other product's existing detail text survives, copied onto its barcode(s).
- **Existing barcode-less products are not retroactively broken.** The "barcode required" rule applies to Add Product going forward only.
- **Validation**: `barcode.description` is always required and non-empty on `POST /products`; `barcode.code` is either a non-empty string or explicitly `null` (never an empty string standing in for "generate one") — enforced both client-side and in `apps/api`'s Zod schema, same defense-in-depth convention `specs/Persistence.md` documents elsewhere. `price`, when provided, must be a non-negative number.
- **Code generation never blocks or retries**: `nextval()` on a dedicated sequence can't collide with a concurrent request or an existing code (see Data) — no unique-violation handling needed for the generated case, unlike a user-typed/scanned code that might already belong to another product.

## Out of scope

- **A dedicated "Prices" menu section/view** for browsing or comparing recorded prices — `specs/BACKLOG.md`'s own placeholder, stays future work. This spec only makes price + code attribution + consumed-batch retention real and queryable.
- **Currency selection or multi-currency support** — see Non-functional.
- **Editing, reactivating, or otherwise interacting with a consumed batch** — write-once from this spec's perspective; a real "purchase history" UI is future work.
- **Attaching more than one code at Add-Product creation time** — one code at creation; additional codes are added afterward via Product Edit's existing, unchanged flow.
- **Any change to the AI/Tavily barcode-lookup pipeline** (`specs/Barcode Scanner & Product info scrape.md`) beyond where its result now lands (the code's description instead of a product field) — the lookup mechanism itself is unchanged.
- **Editing a batch's `price`/`barcode_id` after creation** — `PATCH /products/:id/batches/:batchId` changes `quantity` (and, as a side effect, `consumed`) and `expires_on`. That second field isn't new scope — it's Stock Edit's own pre-existing inline expiration edit, which had nowhere real to persist to before this spec built the endpoint at all, so it rides along here rather than shipping still-broken. `price`/`barcode_id` stay write-once, set only at creation.
