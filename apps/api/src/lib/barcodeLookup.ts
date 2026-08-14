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

async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
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
 * the caller falls through to Tavily.
 */
async function lookupOpenFoodFacts(code: string): Promise<BarcodeLookupResult | null> {
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
    return { short_description: short, long_description: long || undefined, source: "open-food-facts" };
  } catch {
    return null;
  }
}

interface TavilyResult {
  title: string;
  content: string;
}

async function tavilySearch(code: string, apiKey: string): Promise<TavilyResult[] | null> {
  try {
    const res = await withTimeout(TAVILY_TIMEOUT_MS, (signal) =>
      fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey, query: code, max_results: 5 }),
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
 * Feeds Tavily's raw search snippets through the user's configured
 * OpenAI-API-compatible provider (same config `identify-from-photo` was
 * always meant to use, per Product Add.md — this is the first real caller
 * of it) to extract a structured short/long description. Asked to respond
 * with JSON only; a response that doesn't parse is treated as "nothing
 * usable," not a hard error — see the spec's "partial info still fills the
 * form" rule, applied here as "no info still falls through cleanly."
 */
async function extractWithAI(
  code: string,
  results: TavilyResult[],
  creds: Pick<LookupCredentials, "aiApiBaseUrl" | "aiApiKey" | "aiModel">,
): Promise<Pick<BarcodeLookupResult, "short_description" | "long_description"> | null> {
  if (!creds.aiApiBaseUrl || !creds.aiApiKey) return null;
  const snippets = results.map((r) => `- ${r.title}: ${r.content}`).join("\n");
  const prompt = [
    `Barcode ${code} was searched on the web. Based on these search results, identify the specific grocery/household product.`,
    snippets,
    `Respond with ONLY a JSON object: {"short_description": "generic product name, brand-free", "long_description": "more detail, still brand-free"}.`,
    `If you can't confidently identify the product, respond with {}.`,
  ].join("\n\n");

  try {
    const res = await withTimeout(AI_TIMEOUT_MS, (signal) =>
      fetch(`${creds.aiApiBaseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${creds.aiApiKey}` },
        body: JSON.stringify({
          model: creds.aiModel || "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0,
        }),
        signal,
      }),
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = body.choices?.[0]?.message?.content;
    if (!raw) return null;
    // Models sometimes wrap JSON in a markdown fence despite instructions — strip it before parsing.
    const jsonText = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(jsonText) as { short_description?: string; long_description?: string };
    if (!parsed.short_description) return null;
    return { short_description: parsed.short_description, long_description: parsed.long_description || undefined };
  } catch {
    return null;
  }
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
  if (offResult) return offResult;

  if (!creds.tavilyApiKey) return { source: null };
  const results = await tavilySearch(code, creds.tavilyApiKey);
  if (!results) return { source: null };

  const extracted = await extractWithAI(code, results, creds);
  if (!extracted) return { source: null };
  return { ...extracted, source: "tavily" };
}
