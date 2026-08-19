# Delete products

**Status:** draft

## User story

As someone maintaining their product catalog, I want to permanently remove a product I no longer keep, so that my catalog only lists things I actually still buy or track.

## Acceptance criteria

- [ ] Given a row's **⋯** popover on the Product List page (`Product List.md`), when it opens, then a **Delete product** item appears below the existing **Edit product** / **Edit Stock** / **Price History** items — separated by a divider and rendered in the danger/red color, since it's the one destructive option in that menu.
- [ ] Given the user selects **Delete product**, when it's clicked, then a confirmation `Modal` opens naming the product (`short_description`) and stating plainly that deleting is permanent and removes the product along with its batches (including past purchases used by `Price History.md`), aliases, and barcodes.
- [ ] Given the product being deleted has active (non-consumed) batches with stock on hand, when the confirmation modal renders, then it also states how many units/batches will be lost — so deleting a product isn't a silent way to lose stock the user forgot they still had.
- [ ] Given the confirmation modal, when it renders, then it offers **Cancel** and **Delete** (`Button variant="danger"`), with focus starting on **Cancel** — the safer default of the two.
- [ ] Given the user clicks **Cancel**, presses Escape, or clicks outside the modal, then it closes and nothing is deleted — the Product List table is unchanged, row still present.
- [ ] Given the user clicks **Delete**, when the request is in flight, then the Delete button shows its `loading` state and both buttons are disabled, preventing a second submit.
- [ ] Given the delete request succeeds, when it completes, then the modal closes, the row is removed from the table without a full page reload, and a success confirmation is shown (`Alert variant="success"`, same pattern `Settings.md`'s save flow uses).
- [ ] Given the delete request fails (network/server error, or the product was already deleted elsewhere), when that happens, then the modal stays open with an inline `Alert variant="danger"` describing the failure and a way to retry — the row is not removed from the table.

## Data

New endpoint: **`DELETE /products/:id`** (`apps/api/src/routes/products.ts`) — hard-deletes the `products` row. `apps/api/src/db/schema.ts` already declares `onDelete: "cascade"` from `batches`, `product_aliases`, and `barcodes` to `products.id` (`specs/Persistence.md`), so removing the product row is enough for Postgres to remove every associated batch — **including `consumed = true` rows, i.e. this product's entire `Price History.md` data** — alias, and barcode in the same operation. No manual cascade code needed in the route handler.

- `404` if the id no longer exists (e.g. deleted from another tab/session already) — same "not found" shape `PATCH /products/:id` uses today, not a new error format.
- No request body; no soft-delete flag or `deleted_at` column — see Out of scope.

## UI requirements

- **Entry point**: Product List page only (`apps/web/src/pages/ProductList.tsx`), as a new `PopoverItem` appended to the existing "⋯" `Popover` after **Price History**, with a divider above it and danger-red text — matching `Button`'s own `variant="danger"` convention (its doc comment already names "Delete item" as the canonical example).
- **Confirmation dialog**: `shelf-sense-ds`'s `Modal`/`ModalHeader`/`ModalTitle`/`ModalBody`/`ModalFooter` — not a native `confirm()` — consistent with every other confirm flow in this app (Product Add's "Move this barcode?", Product Edit's Save-arms-to-"Confirm?"). Title: `Delete <short_description>?`. Body: what's removed (batches/aliases/barcodes, price history called out by name) plus the active-stock-count line when relevant. Footer: **Cancel** (`variant="secondary"`) + **Delete** (`variant="danger"`, uses `Button`'s built-in `loading` prop while the request is in flight).
- **Success/failure feedback** reuses `Alert variant="success"`/`variant="danger"` — the same component Product List and Settings already use for their own load/save feedback, not a new toast system.

## Non-functional

- **Irreversible**: no undo, no trash/recycle bin. The confirmation modal — plus the explicit stock-loss line when there's stock on hand — is the only safety net. See Out of scope.
- **Atomic**: product + cascaded batches/aliases/barcodes is one database operation (FK cascade), not a client-orchestrated multi-step delete — nothing can partially delete.
- **Local state sync**: on success, `apps/web`'s `productsStore` (`setProducts`/`refetch`) drops the row without a full-page reload, same as every other mutation on this page.
- **Accessibility**: modal traps focus while open, opens with focus on **Cancel**, Escape closes it, focus returns to the **⋯** trigger on close — same baseline `Product List.md`'s own popover already establishes for itself.

## Out of scope

- **Bulk/multi-select delete** — one product per confirmation, matching `Product List.md`'s existing "single-row actions only in this pass" boundary.
- **Soft delete, trash, or an "undo" window** — hard delete only for this pass. Revisit as a `BACKLOG.md` candidate if accidental deletes turn out to be a real problem.
- **Deleting from Inventory's own "•••" row menu** (`Price History.md`) — Product List is the only entry point in this pass; Inventory's menu stays **Edit Stock** / **Price History** only.
- **A delete affordance inside Quick Batch Edit or Product Edit** — neither modal gains a delete button here.
- **Reconciling other screens that reference this product** — Grocery List is a derived, unstored view over live product/batch data (`Grocery List.md`), so there's nothing else to clean up once the row and its cascaded rows are gone.
