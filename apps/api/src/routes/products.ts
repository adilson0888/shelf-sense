import { randomUUID } from "node:crypto";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { barcodes, batches, preferences, productAliases, products } from "../db/schema.js";
import { asyncHandler, HttpError } from "../lib/http-error.js";
import { lookupBarcode } from "../lib/barcodeLookup.js";

export const productsRouter = Router();

// --- Shared row -> JSON reshaping (GET, POST, and PATCH all need this;
// keeps apps/web/src/types.ts's snake_case shape in exactly one place). ---
function toProductJson(
  p: typeof products.$inferSelect,
  aliasRows: { alias: string }[],
  barcodeRows: { id: string; code: string; description: string; productId: string }[],
) {
  return {
    id: p.id,
    short_description: p.shortDescription,
    does_expire: p.doesExpire,
    freshness_threshold_days: p.freshnessThresholdDays,
    minimal_quantity: p.minimalQuantity,
    tracking_mode: p.trackingMode,
    stock_percent: p.stockPercent,
    minimal_percentage: p.minimalPercentage,
    aliases: aliasRows.map((a) => a.alias),
    barcodes: barcodeRows.map((b) => ({ id: b.id, code: b.code, description: b.description, product_id: b.productId })),
  };
}

function toBatchJson(b: typeof batches.$inferSelect) {
  return {
    id: b.id,
    product_id: b.productId,
    quantity: b.quantity,
    expires_on: b.expiresOn,
    barcode_id: b.barcodeId,
    price: b.price,
  };
}

/**
 * GET / — everything Inventory.md needs: every product with its
 * aliases/barcodes nested, and a separate flat Batch[] (product_id links
 * them) — shaped to match apps/web/src/types.ts exactly, so the client does
 * no reshaping of the response. Batches are filtered to consumed = false —
 * every current consumer (Inventory, Product List, Stock Edit, Quick Batch
 * Edit) already treats this array as "current stock"; consumed batches are
 * retained purchase history, reachable via GET /:id/batches?consumed=true
 * instead (specs/Prices & Product Differentiation.md).
 */
productsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [productRows, batchRows, aliasRows, barcodeRows] = await Promise.all([
      db.select().from(products),
      db.select().from(batches).where(eq(batches.consumed, false)),
      db.select().from(productAliases),
      db.select().from(barcodes),
    ]);

    res.json({
      products: productRows.map((p) =>
        toProductJson(
          p,
          aliasRows.filter((a) => a.productId === p.id),
          barcodeRows.filter((b) => b.productId === p.id),
        ),
      ),
      batches: batchRows.map(toBatchJson),
    });
  }),
);

const SINGLETON_PREFS_ID = "singleton";

/**
 * GET /lookup-barcode?code=<code> — specs/Barcode Scanner & Product info
 * scrape.md's external-lookup pipeline (Open Food Facts, then Tavily+AI as
 * the one fallback). Reads the singleton preferences row for the Tavily/AI
 * credentials the fallback needs; missing credentials just means the
 * fallback can't run, not an error (see lookupBarcode's own null-through
 * behavior). This route is only ever reached after the caller's own
 * client-side check against the already-loaded products' barcodes came up
 * empty — a local match never reaches apps/api at all.
 */
productsRouter.get(
  "/lookup-barcode",
  asyncHandler(async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code.trim() : "";
    if (!code) {
      throw new HttpError(400, "code query parameter is required");
    }
    const [prefsRow] = await db.select().from(preferences).where(eq(preferences.id, SINGLETON_PREFS_ID)).limit(1);
    const result = await lookupBarcode(code, {
      tavilyApiKey: prefsRow?.tavilyApiKey ?? null,
      aiApiBaseUrl: prefsRow?.aiApiBaseUrl ?? null,
      aiApiKey: prefsRow?.aiApiKey ?? null,
      aiModel: prefsRow?.aiModel ?? null,
    });
    res.json(result);
  }),
);

// Mirrors apps/web/src/lib/addProduct.ts's buildNewProduct() — this is the
// one save path every Add Product entry method (blank, photo-prefilled,
// match-prefilled, unlink-prefilled) funnels through today. No `barcodes`/
// `aliases` in the payload: nothing in the current UI sets them on create
// (see specs/Persistence.md's note on the trimmed API surface).
const createProductSchema = z
  .object({
    short_description: z.string().trim().min(1, "short_description is required"),
    does_expire: z.boolean(),
    minimal_quantity: z.number().int().nonnegative().nullable().default(null),
    freshness_threshold_days: z.number().int().nonnegative().nullable().default(null),
    quantity: z.number().int().nonnegative().default(0),
    // date-only ISO 8601 ("YYYY-MM-DD"); required only per the refinement below
    expires_on: z.string().nullable().default(null),
    // specs/Relative Tracking.md — fixed at creation, never edited afterward
    // (PATCH /:id below doesn't accept it).
    tracking_mode: z.enum(["units", "percentage"]).default("units"),
    stock_percent: z.number().int().min(0).max(100).nullable().default(null),
    minimal_percentage: z.number().int().min(0).max(100).nullable().default(null),
    // specs/Prices & Product Differentiation.md — description is always
    // required regardless of who/what supplies the code; code is either a
    // real scanned/typed value or null, meaning "generate one for me".
    // No digit-count validation on a provided code (unlike
    // editBarcodeSchema's manually-typed codes below): a scanned value came
    // from BarcodeDetector, not user typing, so it's trusted as-is, and a
    // manually-typed one is validated client-side instead.
    barcode: z.object({
      code: z.string().trim().min(1).nullable(),
      description: z.string().trim().min(1, "barcode description is required"),
    }),
    // Optional; only meaningful alongside an initial batch (quantity > 0).
    price: z.number().nonnegative().nullable().default(null),
  })
  .superRefine((val, ctx) => {
    // Product Add.md's Non-functional section: a hard validation error, not
    // a soft warning — enforced here too, not just in the client form.
    if (val.does_expire && val.quantity > 0 && !val.expires_on) {
      ctx.addIssue({
        code: "custom",
        path: ["expires_on"],
        message: "expires_on is required when does_expire is true and quantity is greater than 0",
      });
    }
    // Relative Tracking.md: a percentage-tracked product never expires — the
    // client already forces this, re-checked here as defense in depth.
    if (val.tracking_mode === "percentage" && val.does_expire) {
      ctx.addIssue({
        code: "custom",
        path: ["does_expire"],
        message: "does_expire must be false when tracking_mode is percentage",
      });
    }
  });

/**
 * POST / — creates a Product and, if quantity > 0, its first Batch.
 * quantity left blank/0 → Product saved with no batch. It does NOT appear
 * in Inventory (specs/Inventory.md excludes 0-total-quantity products) —
 * where a 0-qty product surfaces instead is an open gap, deferred to the
 * forthcoming Product List / Grocery List specs; see specs/BACKLOG.md.
 */
productsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues.map((i) => i.message).join("; "));
    }
    const input = parsed.data;

    const existing = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.shortDescription, input.short_description))
      .limit(1);
    if (existing.length > 0) {
      throw new HttpError(409, `A product named "${input.short_description}" already exists`);
    }

    const productId = randomUUID();
    // A percentage-tracked product never gets a Batch — its stock lives
    // directly on stockPercent (specs/Relative Tracking.md's Data section).
    const isPercentage = input.tracking_mode === "percentage";
    const batchId = !isPercentage && input.quantity > 0 ? randomUUID() : null;
    const stockPercent = isPercentage ? (input.stock_percent ?? 100) : null;
    const minimalPercentage = isPercentage ? input.minimal_percentage : null;
    const barcodeId = randomUUID();

    let resolvedCode: string;
    try {
      resolvedCode = await db.transaction(async (tx) => {
        // specs/Prices & Product Differentiation.md — every product gets at
        // least one barcode now; when the user has no real code, the
        // smallest possible unique one is generated here. nextval() can't
        // repeat, so no collision-retry is needed for the generated case.
        const code =
          input.barcode.code ??
          String((await tx.execute<{ code: string }>(sql`select nextval('generated_barcode_code_seq') as code`)).rows[0].code);

        await tx.insert(products).values({
          id: productId,
          shortDescription: input.short_description,
          doesExpire: input.does_expire,
          freshnessThresholdDays: input.freshness_threshold_days,
          minimalQuantity: input.minimal_quantity,
          trackingMode: input.tracking_mode,
          stockPercent,
          minimalPercentage,
        });
        // Barcode must exist before a batch can reference it via barcodeId.
        await tx.insert(barcodes).values({ id: barcodeId, productId, code, description: input.barcode.description });
        if (batchId) {
          await tx.insert(batches).values({
            id: batchId,
            productId,
            quantity: input.quantity,
            expiresOn: input.does_expire ? input.expires_on : null,
            barcodeId,
            price: input.price,
          });
        }

        return code;
      });
    } catch (err) {
      // short_description's own uniqueness is pre-checked above and never
      // reaches here — a caught violation at this point is the barcode
      // (the only other unique constraint this insert touches), but this
      // still routes through the same constraint-name switch PATCH uses
      // below, for one shared source of the user-facing message.
      const constraint = pgUniqueViolationConstraint(err);
      if (constraint !== undefined) {
        throw friendlyConflictError(constraint);
      }
      throw err;
    }

    res.status(201).json({
      product: {
        id: productId,
        short_description: input.short_description,
        does_expire: input.does_expire,
        freshness_threshold_days: input.freshness_threshold_days,
        minimal_quantity: input.minimal_quantity,
        tracking_mode: input.tracking_mode,
        stock_percent: stockPercent,
        minimal_percentage: minimalPercentage,
        aliases: [] as string[],
        barcodes: [
          { id: barcodeId, code: resolvedCode, description: input.barcode.description, product_id: productId },
        ] as { id: string; code: string; description: string; product_id: string }[],
      },
      batch: batchId
        ? {
            id: batchId,
            product_id: productId,
            quantity: input.quantity,
            expires_on: input.does_expire ? input.expires_on : null,
            barcode_id: barcodeId,
            price: input.price,
          }
        : null,
    });
  }),
);

// Same "at least 8 digits" rule apps/web/src/lib/productEdit.ts's
// newBarcodeValid() already enforces client-side — re-checked here too.
// The "at least 8 digits" rule apps/web/src/lib/productEdit.ts's
// newBarcodeValid() enforces is UX gating for a human typing a brand-new
// code by hand — not re-enforced here, since this array is always the
// product's *full* desired list (specs/Prices & Product Differentiation.md's
// Data section), including every code it already had before this edit,
// unchanged or not. A system-generated code (deliberately short, see that
// spec) or a moved-in code from another product would otherwise fail this
// check every time the product is saved for any unrelated reason.
const editBarcodeSchema = z.object({
  code: z.string().trim().min(1, "barcode code is required"),
  description: z.string().trim().default(""),
});

const otherProductUpdateSchema = z.object({
  product_id: z.string().uuid(),
  remove_barcode_codes: z.array(z.string()).default([]),
  remove_aliases: z.array(z.string()).default([]),
});

// Mirrors apps/web/src/lib/productEdit.ts's ProductEditResult almost
// exactly: this body's top-level fields are `updatedProduct` (minus `id`,
// which comes from the URL), and `other_product_updates` is
// `otherProductUpdates` — the frontend's own confirm-move UI has already
// resolved every add-vs-move conflict before Save is even clickable, so
// this is applying an already-made decision, not re-deriving one.
// `aliases`/`barcodes` are each product's *final* desired list, not a diff
// — barcodes carry no client id since the client's own temp ids
// (`${productId}-bc${Date.now()}`) aren't real DB ids; the server diffs by
// `code` and mints UUIDs for genuinely new rows.
const editProductSchema = z.object({
  short_description: z.string().trim().min(1, "short_description is required"),
  does_expire: z.boolean(),
  minimal_quantity: z.number().int().nonnegative().nullable().default(null),
  freshness_threshold_days: z.number().int().nonnegative().nullable().default(null),
  // specs/Relative Tracking.md: tracking_mode/stock_percent are fixed at
  // creation and NOT accepted here — Product Edit never touches them.
  // minimal_percentage is the one Relative Tracking field this view does
  // edit, meaningful only on a percentage-tracked product.
  minimal_percentage: z.number().int().min(0).max(100).nullable().default(null),
  aliases: z.array(z.string().trim().min(1)).default([]),
  barcodes: z.array(editBarcodeSchema).default([]),
  other_product_updates: z.array(otherProductUpdateSchema).default([]),
});

// drizzle-orm wraps the real `pg` error in its own error class, with the
// `code`/`constraint` fields Postgres actually sets living on `.cause`, not
// on the thrown error itself — checking `err.code` directly (as both catch
// blocks below originally did) silently misses every real conflict and
// falls through to a bare 500. Checks both shapes so this works regardless
// of which layer the error surfaces at.
function pgUniqueViolationConstraint(err: unknown): string | undefined {
  for (const candidate of [err, (err as { cause?: unknown } | null)?.cause]) {
    if (candidate && typeof candidate === "object" && "code" in candidate && (candidate as { code?: string }).code === "23505") {
      return (candidate as { constraint?: string }).constraint;
    }
  }
  return undefined;
}

// Maps a Postgres unique-violation onto the same 409 shape the pre-checks
// below use — a defense-in-depth backstop for a stale client, not the
// primary defense (the pre-checks and other_product_updates ordering are).
function friendlyConflictError(constraint: string | undefined): HttpError {
  switch (constraint) {
    case "products_short_description_unique":
      return new HttpError(409, "A product with that name already exists");
    case "product_aliases_alias_unique":
      return new HttpError(409, "That alias is already linked to another product");
    case "barcodes_code_unique":
      return new HttpError(409, "That barcode is already linked to another product");
    default:
      return new HttpError(409, "That change conflicts with another product's data");
  }
}

/**
 * PATCH /:id — Product Edit.md's Save. Applies field edits, alias/barcode
 * add/remove/move, and the does_expire-off batch cascade as ONE atomic
 * transaction (specs/Persistence.md: a moved barcode/alias must never, even
 * momentarily, belong to both or neither product).
 */
productsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = editProductSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues.map((i) => i.message).join("; "));
    }
    const id = req.params.id;
    const input = parsed.data;

    // Defensive de-dupe: a same-request duplicate code/alias shouldn't
    // surface as a spurious conflict against itself.
    const desiredAliases = [...new Set(input.aliases)];
    const desiredBarcodes = Array.from(new Map(input.barcodes.map((b) => [b.code, b])).values());

    let response: { product: ReturnType<typeof toProductJson>; batches: ReturnType<typeof toBatchJson>[] };

    try {
      response = await db.transaction(async (tx) => {
        const existing = await tx.select({ id: products.id }).from(products).where(eq(products.id, id)).limit(1);
        if (existing.length === 0) {
          throw new HttpError(404, "Product not found");
        }

        const conflict = await tx
          .select({ id: products.id })
          .from(products)
          .where(and(eq(products.shortDescription, input.short_description), ne(products.id, id)))
          .limit(1);
        if (conflict.length > 0) {
          throw new HttpError(409, `A product named "${input.short_description}" already exists`);
        }

        // Apply cross-product removals FIRST so the unique index is free
        // before this product's own inserts land below — never a moment
        // where a moved barcode/alias belongs to both or neither product.
        for (const other of input.other_product_updates) {
          if (other.remove_barcode_codes.length > 0) {
            await tx
              .delete(barcodes)
              .where(and(eq(barcodes.productId, other.product_id), inArray(barcodes.code, other.remove_barcode_codes)));
          }
          if (other.remove_aliases.length > 0) {
            await tx
              .delete(productAliases)
              .where(and(eq(productAliases.productId, other.product_id), inArray(productAliases.alias, other.remove_aliases)));
          }
        }

        // --- Aliases: diff current vs. desired, exact-string comparison
        // (matches how productEdit.ts stores/removes aliases). ---
        const currentAliasRows = await tx
          .select({ alias: productAliases.alias })
          .from(productAliases)
          .where(eq(productAliases.productId, id));
        const currentAliases = new Set(currentAliasRows.map((a) => a.alias));
        const desiredAliasSet = new Set(desiredAliases);

        const aliasesToRemove = [...currentAliases].filter((a) => !desiredAliasSet.has(a));
        const aliasesToAdd = desiredAliases.filter((a) => !currentAliases.has(a));

        if (aliasesToRemove.length > 0) {
          await tx.delete(productAliases).where(and(eq(productAliases.productId, id), inArray(productAliases.alias, aliasesToRemove)));
        }
        if (aliasesToAdd.length > 0) {
          await tx.insert(productAliases).values(aliasesToAdd.map((alias) => ({ id: randomUUID(), productId: id, alias })));
        }

        // --- Barcodes: diff by code; description-only changes are an
        // UPDATE, code changes are remove-old/add-new. ---
        const currentBarcodeRows = await tx
          .select({ id: barcodes.id, code: barcodes.code, description: barcodes.description })
          .from(barcodes)
          .where(eq(barcodes.productId, id));
        const currentByCode = new Map(currentBarcodeRows.map((b) => [b.code, b]));
        const desiredCodes = new Set(desiredBarcodes.map((b) => b.code));

        const codesToRemove = currentBarcodeRows.filter((b) => !desiredCodes.has(b.code)).map((b) => b.code);
        if (codesToRemove.length > 0) {
          await tx.delete(barcodes).where(and(eq(barcodes.productId, id), inArray(barcodes.code, codesToRemove)));
        }
        for (const desired of desiredBarcodes) {
          const current = currentByCode.get(desired.code);
          if (!current) {
            await tx.insert(barcodes).values({ id: randomUUID(), productId: id, code: desired.code, description: desired.description });
          } else if (current.description !== desired.description) {
            await tx.update(barcodes).set({ description: desired.description }).where(eq(barcodes.id, current.id));
          }
        }

        // --- The product row itself. ---
        await tx
          .update(products)
          .set({
            shortDescription: input.short_description,
            doesExpire: input.does_expire,
            freshnessThresholdDays: input.freshness_threshold_days,
            minimalQuantity: input.minimal_quantity,
            minimalPercentage: input.minimal_percentage,
          })
          .where(eq(products.id, id));

        // --- does_expire off -> clear expires_on on every one of this
        // product's batches. Unconditional/idempotent per the spec. ---
        if (!input.does_expire) {
          await tx.update(batches).set({ expiresOn: null }).where(eq(batches.productId, id));
        }

        // Re-select post-write state for the response — reflects exactly
        // what committed, not what the code above assumed it wrote.
        const [productRow] = await tx.select().from(products).where(eq(products.id, id)).limit(1);
        const [finalAliasRows, finalBarcodeRows, finalBatchRows] = await Promise.all([
          tx.select({ alias: productAliases.alias }).from(productAliases).where(eq(productAliases.productId, id)),
          tx.select().from(barcodes).where(eq(barcodes.productId, id)),
          // consumed = false — same "invisible in every active view" rule
          // GET / applies (specs/Prices & Product Differentiation.md).
          tx.select().from(batches).where(and(eq(batches.productId, id), eq(batches.consumed, false))),
        ]);

        return {
          product: toProductJson(productRow, finalAliasRows, finalBarcodeRows),
          batches: finalBatchRows.map(toBatchJson),
        };
      });
    } catch (err) {
      if (err instanceof HttpError) throw err;
      const constraint = pgUniqueViolationConstraint(err);
      if (constraint !== undefined) {
        throw friendlyConflictError(constraint);
      }
      throw err;
    }

    res.json(response);
  }),
);

// specs/Prices & Product Differentiation.md — Stock Edit and Quick Batch
// Edit were local-state only until this spec; these three routes are the
// real batch-mutation API neither of them had before.

const createBatchSchema = z.object({
  quantity: z.number().int().positive(),
  // date-only ISO 8601 ("YYYY-MM-DD"); required only when the product expires.
  expires_on: z.string().nullable().default(null),
  barcode_id: z.string().uuid().nullable().default(null),
  price: z.number().nonnegative().nullable().default(null),
});

/**
 * POST /:id/batches — add a batch (a purchase/lot) to an existing product.
 * Percentage-tracked products carry no Batch rows at all (specs/Relative
 * Tracking.md) — rejected here rather than silently accepted.
 */
productsRouter.post(
  "/:id/batches",
  asyncHandler(async (req, res) => {
    const parsed = createBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues.map((i) => i.message).join("; "));
    }
    const input = parsed.data;
    const productId = req.params.id;

    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!product) {
      throw new HttpError(404, "Product not found");
    }
    if (product.trackingMode === "percentage") {
      throw new HttpError(400, "This product is tracked by percentage — it doesn't carry batches");
    }
    if (product.doesExpire && !input.expires_on) {
      throw new HttpError(400, "expires_on is required for a product that expires");
    }
    if (input.barcode_id) {
      const [barcode] = await db
        .select({ id: barcodes.id })
        .from(barcodes)
        .where(and(eq(barcodes.id, input.barcode_id), eq(barcodes.productId, productId)))
        .limit(1);
      if (!barcode) {
        throw new HttpError(400, "barcode_id must belong to this product");
      }
    }

    const batchId = randomUUID();
    const [inserted] = await db
      .insert(batches)
      .values({
        id: batchId,
        productId,
        quantity: input.quantity,
        expiresOn: product.doesExpire ? input.expires_on : null,
        barcodeId: input.barcode_id,
        price: input.price,
      })
      .returning();

    res.status(201).json({ batch: toBatchJson(inserted) });
  }),
);

const updateBatchSchema = z.object({
  quantity: z.number().int().nonnegative(),
  // Stock Edit.md's pre-existing inline expiration edit — unrelated to
  // this spec, but this is now the only real persistence path for it.
  // Omitted = leave expires_on unchanged; price/barcode_id aren't
  // editable after creation either way.
  expires_on: z.string().nullable().optional(),
});

/**
 * PATCH /:id/batches/:batchId — quantity (and optionally expires_on)
 * change. Reaching 0 sets consumed = true instead of deleting the row, so
 * a recorded price survives the batch being fully used — resolves
 * specs/BACKLOG.md's "Batch cost tracking & consumed-batch history" entry.
 */
productsRouter.patch(
  "/:id/batches/:batchId",
  asyncHandler(async (req, res) => {
    const parsed = updateBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues.map((i) => i.message).join("; "));
    }
    const { id: productId, batchId } = req.params;
    const expiresOnProvided = "expires_on" in req.body;

    const [batch] = await db
      .select()
      .from(batches)
      .where(and(eq(batches.id, batchId), eq(batches.productId, productId)))
      .limit(1);
    if (!batch) {
      throw new HttpError(404, "Batch not found");
    }
    if (batch.consumed) {
      throw new HttpError(400, "This batch has already been consumed and can't be edited");
    }

    const [updated] = await db
      .update(batches)
      .set({
        quantity: parsed.data.quantity,
        consumed: parsed.data.quantity === 0,
        ...(expiresOnProvided ? { expiresOn: parsed.data.expires_on ?? null } : {}),
      })
      .where(eq(batches.id, batchId))
      .returning();

    res.json({ batch: toBatchJson(updated) });
  }),
);

/**
 * GET /:id/batches?consumed=true — reads a product's consumed (retained,
 * history-only) batches. Not consumed by any UI in this pass — exists so
 * the future Prices/purchase-history view has real data to query.
 * Omitting the query param (or ?consumed=false) mirrors GET /'s own
 * "current stock" default instead.
 */
productsRouter.get(
  "/:id/batches",
  asyncHandler(async (req, res) => {
    const productId = req.params.id;
    const consumed = req.query.consumed === "true";
    const rows = await db
      .select()
      .from(batches)
      .where(and(eq(batches.productId, productId), eq(batches.consumed, consumed)));
    res.json({ batches: rows.map(toBatchJson) });
  }),
);
