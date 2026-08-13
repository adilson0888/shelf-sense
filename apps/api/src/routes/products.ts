import { randomUUID } from "node:crypto";
import { and, eq, inArray, ne } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { barcodes, batches, productAliases, products } from "../db/schema.js";
import { asyncHandler, HttpError } from "../lib/http-error.js";

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
    long_description: p.longDescription,
    does_expire: p.doesExpire,
    freshness_threshold_days: p.freshnessThresholdDays,
    minimal_quantity: p.minimalQuantity,
    aliases: aliasRows.map((a) => a.alias),
    barcodes: barcodeRows.map((b) => ({ id: b.id, code: b.code, description: b.description, product_id: b.productId })),
  };
}

function toBatchJson(b: typeof batches.$inferSelect) {
  return { id: b.id, product_id: b.productId, quantity: b.quantity, expires_on: b.expiresOn };
}

/**
 * GET / — everything Inventory.md needs: every product with its
 * aliases/barcodes nested, and a separate flat Batch[] (product_id links
 * them) — shaped to match apps/web/src/types.ts exactly, so the client does
 * no reshaping of the response.
 */
productsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [productRows, batchRows, aliasRows, barcodeRows] = await Promise.all([
      db.select().from(products),
      db.select().from(batches),
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

// Mirrors apps/web/src/lib/addProduct.ts's buildNewProduct() — this is the
// one save path every Add Product entry method (blank, photo-prefilled,
// match-prefilled, unlink-prefilled) funnels through today. No `barcodes`/
// `aliases` in the payload: nothing in the current UI sets them on create
// (see specs/Persistence.md's note on the trimmed API surface).
const createProductSchema = z
  .object({
    short_description: z.string().trim().min(1, "short_description is required"),
    long_description: z.string().trim().default(""),
    does_expire: z.boolean(),
    minimal_quantity: z.number().int().nonnegative().nullable().default(null),
    freshness_threshold_days: z.number().int().nonnegative().nullable().default(null),
    quantity: z.number().int().nonnegative().default(0),
    // date-only ISO 8601 ("YYYY-MM-DD"); required only per the refinement below
    expires_on: z.string().nullable().default(null),
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
    const batchId = input.quantity > 0 ? randomUUID() : null;

    await db.transaction(async (tx) => {
      await tx.insert(products).values({
        id: productId,
        shortDescription: input.short_description,
        longDescription: input.long_description,
        doesExpire: input.does_expire,
        freshnessThresholdDays: input.freshness_threshold_days,
        minimalQuantity: input.minimal_quantity,
      });
      if (batchId) {
        await tx.insert(batches).values({
          id: batchId,
          productId,
          quantity: input.quantity,
          expiresOn: input.does_expire ? input.expires_on : null,
        });
      }
    });

    res.status(201).json({
      product: {
        id: productId,
        short_description: input.short_description,
        long_description: input.long_description,
        does_expire: input.does_expire,
        freshness_threshold_days: input.freshness_threshold_days,
        minimal_quantity: input.minimal_quantity,
        aliases: [] as string[],
        barcodes: [] as { id: string; code: string; description: string; product_id: string }[],
      },
      batch: batchId
        ? {
            id: batchId,
            product_id: productId,
            quantity: input.quantity,
            expires_on: input.does_expire ? input.expires_on : null,
          }
        : null,
    });
  }),
);

// Same "at least 8 digits" rule apps/web/src/lib/productEdit.ts's
// newBarcodeValid() already enforces client-side — re-checked here too.
const editBarcodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "barcode code is required")
    .refine((c) => c.replace(/\D/g, "").length >= 8, "barcode code must contain at least 8 digits"),
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
  long_description: z.string().trim().default(""),
  does_expire: z.boolean(),
  minimal_quantity: z.number().int().nonnegative().nullable().default(null),
  freshness_threshold_days: z.number().int().nonnegative().nullable().default(null),
  aliases: z.array(z.string().trim().min(1)).default([]),
  barcodes: z.array(editBarcodeSchema).default([]),
  other_product_updates: z.array(otherProductUpdateSchema).default([]),
});

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
            longDescription: input.long_description,
            doesExpire: input.does_expire,
            freshnessThresholdDays: input.freshness_threshold_days,
            minimalQuantity: input.minimal_quantity,
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
          tx.select().from(batches).where(eq(batches.productId, id)),
        ]);

        return {
          product: toProductJson(productRow, finalAliasRows, finalBarcodeRows),
          batches: finalBatchRows.map(toBatchJson),
        };
      });
    } catch (err) {
      if (err instanceof HttpError) throw err;
      if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "23505") {
        throw friendlyConflictError((err as { constraint?: string }).constraint);
      }
      throw err;
    }

    res.json(response);
  }),
);
