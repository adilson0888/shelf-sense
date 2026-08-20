import { asc, eq, inArray } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { barcodes, comparisonSites, preferences, products } from "../db/schema.js";
import { asyncHandler, HttpError } from "../lib/http-error.js";
import { searchPrices } from "../lib/priceSearch.js";

/**
 * specs/Price comparison.md — POST /price-search. Given the barcodes
 * currently visible in Price History's legend at click time (server never
 * sees "General" — the client excludes it, see usePriceHistory.ts), returns
 * a price matrix (barcode × every saved comparison site) via
 * lib/priceSearch.ts's Tavily + AI pipeline. Nothing here is persisted —
 * live-only, per that spec's Non-functional section.
 */
export const priceSearchRouter = Router();

const SINGLETON_PREFS_ID = "singleton";

const priceSearchSchema = z.object({
  barcode_ids: z.array(z.string().uuid()).min(1, "barcode_ids must include at least one barcode"),
});

priceSearchRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = priceSearchSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues.map((i) => i.message).join("; "));
    }
    const { barcode_ids } = parsed.data;

    const [barcodeRows, siteRows, prefsRows] = await Promise.all([
      db.select().from(barcodes).where(inArray(barcodes.id, barcode_ids)),
      db.select().from(comparisonSites).orderBy(asc(comparisonSites.createdAt)),
      db.select().from(preferences).where(eq(preferences.id, SINGLETON_PREFS_ID)).limit(1),
    ]);
    if (barcodeRows.length !== barcode_ids.length) {
      throw new HttpError(400, "One or more barcode_ids not found");
    }
    // Preserve the request's order (inArray doesn't guarantee it) — the
    // response's row order should match what the client asked for.
    const barcodeById = new Map(barcodeRows.map((b) => [b.id, b]));
    const orderedBarcodes = barcode_ids.map((id) => barcodeById.get(id)!);

    // The Tavily query is the product + barcode's own description text,
    // never the bare code — see lib/priceSearch.ts's module doc for why.
    const productRows = await db
      .select({ id: products.id, shortDescription: products.shortDescription })
      .from(products)
      .where(inArray(products.id, [...new Set(orderedBarcodes.map((b) => b.productId))]));
    const productById = new Map(productRows.map((p) => [p.id, p]));

    const prefsRow = prefsRows[0];
    const rows = await searchPrices(
      orderedBarcodes.map((b) => {
        const label = b.description || b.code;
        const productName = productById.get(b.productId)?.shortDescription;
        return { id: b.id, query: [productName, b.description].filter(Boolean).join(" ") || b.code, label };
      }),
      siteRows.map((s) => ({ id: s.id, label: s.label, domain: s.domain })),
      {
        // Same independent-per-credential env-var fallback products.ts's
        // GET /lookup-barcode already uses (specs/Advanced Settings.md).
        tavilyApiKey: prefsRow?.tavilyApiKey ?? process.env.TAVILY_API_KEY ?? null,
        aiApiBaseUrl: prefsRow?.aiApiBaseUrl ?? process.env.AI_API_BASE_URL ?? null,
        aiApiKey: prefsRow?.aiApiKey ?? process.env.AI_API_KEY ?? null,
        aiModel: prefsRow?.aiModel ?? process.env.AI_MODEL ?? null,
      },
    );
    res.json({ rows });
  }),
);
