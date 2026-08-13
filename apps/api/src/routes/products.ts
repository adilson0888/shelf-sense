import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { barcodes, batches, productAliases, products } from "../db/schema.js";
import { asyncHandler, HttpError } from "../lib/http-error.js";

export const productsRouter = Router();

/**
 * GET / — everything Product List.md needs: every product with its
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
      products: productRows.map((p) => ({
        id: p.id,
        short_description: p.shortDescription,
        long_description: p.longDescription,
        does_expire: p.doesExpire,
        freshness_threshold_days: p.freshnessThresholdDays,
        minimal_quantity: p.minimalQuantity,
        aliases: aliasRows.filter((a) => a.productId === p.id).map((a) => a.alias),
        barcodes: barcodeRows
          .filter((b) => b.productId === p.id)
          .map((b) => ({ id: b.id, code: b.code, description: b.description, product_id: b.productId })),
      })),
      batches: batchRows.map((b) => ({
        id: b.id,
        product_id: b.productId,
        quantity: b.quantity,
        expires_on: b.expiresOn,
      })),
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
 * quantity left blank/0 → Product saved with no batch (Product Add.md's
 * acceptance criteria: appears in Product List as present but out of stock).
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
