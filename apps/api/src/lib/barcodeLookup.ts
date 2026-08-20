/**
 * specs/Barcode Scanner & Product info scrape.md's provider pipeline for
 * GET /products/lookup-barcode: Open Food Facts first, Tavily-search +
 * AI-extraction as the one fallback, then nothing (source: null) — see
 * that spec's Data section and Non-functional "provider order is fixed"
 * note. Each provider call is time-boxed so a slow/hanging third party
 * never blocks the request indefinitely.
 */

export interface BarcodeLookupResult {
  short_description?: string;
  long_description?: string;
  source: "open-food-facts" | "tavily" | null;
}

export interface LookupCredentials {
  tavilyApiKey: string | null;
  aiApiBaseUrl: string | null;
  aiApiKey: string | null;
  aiModel: string | null;
}

const OFF_TIMEOUT_MS = 8_000;
const TAVILY_TIMEOUT_MS = 10_000;
const AI_TIMEOUT_MS = 15_000;

export async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Open Food Facts' public read API — free, keyless (see Product Add.md's
 * own note suggesting it as a starting point). A miss or any error/timeout
 * here is expected, ordinary flow control, not something to log loudly —
 * the caller falls through to Tavily. Returns the raw fields as-is; the
 * caller decides whether to run them through AI extraction (see
 * `lookupBarcode` — an Open Food Facts hit never *requires* AI to be
 * useful, per the spec).
 */
async function lookupOpenFoodFacts(
  code: string,
): Promise<{ short_description: string; long_description?: string; rawText: string } | null> {
  try {
    const res = await withTimeout(OFF_TIMEOUT_MS, (signal) =>
      fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`, { signal }),
    );
    if (!res.ok) return null;
    const body = (await res.json()) as {
      status?: number;
      product?: { product_name?: string; generic_name?: string; ingredients_text?: string };
    };
    if (body.status !== 1 || !body.product) return null;
    const short = body.product.product_name?.trim();
    if (!short) return null;
    const long = (body.product.generic_name || body.product.ingredients_text || "").trim();
    const rawText = [
      `Product name: ${short}`,
      body.product.generic_name?.trim() ? `Generic name: ${body.product.generic_name.trim()}` : null,
      body.product.ingredients_text?.trim() ? `Ingredients: ${body.product.ingredients_text.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    return { short_description: short, long_description: long || undefined, rawText };
  } catch {
    return null;
  }
}

export interface TavilyResult {
  title: string;
  content: string;
}

/**
 * `includeDomains` restricts results to those sites — specs/Price
 * comparison.md's lib/priceSearch.ts is the one caller that passes it
 * (the user's saved comparison sites); the barcode-lookup fallback below
 * searches the open web, same as always.
 */
export async function tavilySearch(code: string, apiKey: string, includeDomains?: string[]): Promise<TavilyResult[] | null> {
  try {
    const res = await withTimeout(TAVILY_TIMEOUT_MS, (signal) =>
      fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query: code,
          max_results: 5,
          ...(includeDomains?.length ? { include_domains: includeDomains } : {}),
        }),
        signal,
      }),
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { results?: TavilyResult[] };
    return body.results?.length ? body.results : null;
  } catch {
    return null;
  }
}

/**
 * Feeds a raw text blob — Open Food Facts' own fields, or Tavily's search
 * snippets — through the user's configured OpenAI-API-compatible provider
 * (same config `identify-from-photo` was always meant to use, per Product
 * Add.md) to extract a brand-aware, three-part split:
 * specs/Prices & Product Differentiation.md put every product's
 * differentiating detail (pack size, variant, brand) on its barcode's own
 * `description`, not a product field, so this asks for that detail
 * separately from the generic/category name rather than folding brand into
 * (or out of) a single blob. `long_description` is assembled by the caller
 * as `[variant_description, brand].filter(Boolean).join(" ")` — guarantees
 * brand always lands last regardless of what the model produces.
 *
 * Asked to respond with JSON only; a response that doesn't parse is
 * treated as "nothing usable," not a hard error — see the spec's "partial
 * info still fills the form" rule, applied here as "no info still falls
 * through cleanly."
 */
async function extractProductDetails(
  code: string,
  rawText: string,
  creds: Pick<LookupCredentials, "aiApiBaseUrl" | "aiApiKey" | "aiModel">,
): Promise<{ short_description: string; variant_description?: string; brand?: string } | null> {
  if (!creds.aiApiBaseUrl || !creds.aiApiKey) return null;
  const prompt = [
    `Barcode ${code} resolved to the following raw product info. Identify the specific grocery/household product, splitting out its brand from its generic description.`,
    rawText,
    `Respond with ONLY a JSON object with three parts:`,
    `{"short_description": "generic/category name, brand-free", "variant_description": "pack size/type/other distinguishing detail, brand-free", "brand": "the brand if identifiable, else empty"}`,
    `Example: raw text "Papel Higiênico folha dupla Neve 30m" -> {"short_description": "Papel Higiênico", "variant_description": "Folha dupla 30m", "brand": "Neve"}.`,
    `If you can't confidently identify the product, respond with {}.`,
  ].join("\n\n");

  try {
    const postChat = (extra: Record<string, unknown>) =>
      withTimeout(AI_TIMEOUT_MS, (signal) =>
        fetch(`${creds.aiApiBaseUrl}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${creds.aiApiKey}` },
          body: JSON.stringify({
            model: creds.aiModel || "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            ...extra,
          }),
          signal,
        }),
      );

    // temperature: 0 asks for deterministic-ish output, but some
    // OpenAI-compatible backends (e.g. certain Claude gateways) reject the
    // param outright for particular models with a 400. Retry once without it
    // rather than losing the whole extraction over a param they don't want.
    let res = await postChat({ temperature: 0 });
    if (!res.ok && res.status === 400) {
      const errBody = await res.clone().text();
      if (/temperature/i.test(errBody)) {
        res = await postChat({});
      }
    }
    if (!res.ok) return null;
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = body.choices?.[0]?.message?.content;
    if (!raw) return null;
    // Models sometimes wrap JSON in a markdown fence despite instructions — strip it before parsing.
    const jsonText = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(jsonText) as {
      short_description?: string;
      variant_description?: string;
      brand?: string;
    };
    if (!parsed.short_description) return null;
    return {
      short_description: parsed.short_description,
      variant_description: parsed.variant_description || undefined,
      brand: parsed.brand || undefined,
    };
  } catch {
    return null;
  }
}

/** `[variant_description, brand].filter(Boolean).join(" ")` — see extractProductDetails. */
function assembleLongDescription(parts: { variant_description?: string; brand?: string }): string | undefined {
  const joined = [parts.variant_description, parts.brand].filter(Boolean).join(" ");
  return joined || undefined;
}

/**
 * Orchestrates the fixed provider order for GET /products/lookup-barcode.
 * Every branch is allowed to fail silently and fall through — the only
 * "real" outcome besides a hit is `{ source: null }`, never a thrown error
 * (a third-party outage shouldn't 500 the Add Product flow; it should just
 * open the manual form blank, per the spec).
 */
export async function lookupBarcode(code: string, creds: LookupCredentials): Promise<BarcodeLookupResult> {
  const offResult = await lookupOpenFoodFacts(code);
  if (offResult) {
    // AI is a refinement here, never a requirement — Open Food Facts' raw
    // fields are already useful on their own (see spec's "a match never
    // requires AI to be useful").
    const refined = await extractProductDetails(code, offResult.rawText, creds);
    if (refined) {
      return {
        short_description: refined.short_description,
        long_description: assembleLongDescription(refined),
        source: "open-food-facts",
      };
    }
    return {
      short_description: offResult.short_description,
      long_description: offResult.long_description,
      source: "open-food-facts",
    };
  }

  if (!creds.tavilyApiKey) return { source: null };
  const results = await tavilySearch(code, creds.tavilyApiKey);
  if (!results) return { source: null };

  const snippets = results.map((r) => `- ${r.title}: ${r.content}`).join("\n");
  const extracted = await extractProductDetails(code, snippets, creds);
  if (!extracted) return { source: null };
  return {
    short_description: extracted.short_description,
    long_description: assembleLongDescription(extracted),
    source: "tavily",
  };
}
