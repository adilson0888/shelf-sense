# Backlog

Ideas that are real — we intend to build them eventually — but are deliberately deferred to keep the current spec(s) and implementation lean. Different from a spec's **Out of scope** section: out-of-scope means "not this spec's job, maybe never"; an entry here means "yes, later."

When something's deferred out of a spec, leave a short pointer back to this file rather than deleting the requirement outright. When it's time to pick an entry up, promote it into a real spec via the normal loop (`specs/README.md`) — write/update the target spec's acceptance criteria, data, and UI requirements properly; don't just delete the entry here and start coding from these notes alone.

## Product icons

Pulled from `Product List.md` and `Product Add.md` (2026-08-11) — the approved Product List design didn't render an icon anywhere, which prompted deferring the whole feature rather than resolving the mismatch.

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
- **`Product.icon: string` field** (optional, product-level, not per-batch) — back on the `Product` interface in `Product List.md`/`Product Add.md` when this is picked up.
- **Rendering**: on Product List rows, and in Product Add's match-review step (alongside the matched product's `short_description`/`long_description`).
- **Pending state UX**: spinner/placeholder treatment while generation is in flight.
- **Icon regeneration** after the fact — not applicable until general product editing exists either (see that same gap noted in `Product Add.md`'s Out of scope).
