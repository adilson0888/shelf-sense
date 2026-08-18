import type { PreferencesResponse, ProductsSnapshot } from "shelf-sense-core";
import type { SQLiteDatabase } from "expo-sqlite";

export const CACHE_KEYS = {
  products: "products_snapshot",
  preferences: "preferences_snapshot",
  theme: "theme",
} as const;

type CacheKey = (typeof CACHE_KEYS)[keyof typeof CACHE_KEYS];

interface CacheRow {
  value: string;
}

async function readCache<T>(
  db: SQLiteDatabase,
  key: CacheKey,
  validate: (value: unknown) => value is T,
): Promise<T | null> {
  const row = await db.getFirstAsync<CacheRow>("SELECT value FROM app_cache WHERE key = ?", key);
  if (!row) return null;

  try {
    const value: unknown = JSON.parse(row.value);
    if (validate(value)) return value;
  } catch {
    // Invalid cache is discarded below; it must never block network bootstrap.
  }
  await db.runAsync("DELETE FROM app_cache WHERE key = ?", key);
  return null;
}

async function replaceCache(db: SQLiteDatabase, key: CacheKey, value: unknown): Promise<void> {
  await db.runAsync(
    `INSERT INTO app_cache (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    key,
    JSON.stringify(value),
    new Date().toISOString(),
  );
}

function isProductsSnapshot(value: unknown): value is ProductsSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ProductsSnapshot>;
  return Array.isArray(candidate.products) && Array.isArray(candidate.batches);
}

function isPreferences(value: unknown): value is PreferencesResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PreferencesResponse>;
  return (
    (candidate.language === "en-US" || candidate.language === "pt-BR") &&
    typeof candidate.has_saved_preferences === "boolean" &&
    typeof candidate.default_minimal_quantity === "number" &&
    typeof candidate.default_minimal_percentage === "number" &&
    typeof candidate.default_freshness_threshold_days === "number"
  );
}

export const cacheRepository = {
  readProducts(db: SQLiteDatabase): Promise<ProductsSnapshot | null> {
    return readCache(db, CACHE_KEYS.products, isProductsSnapshot);
  },
  writeProducts(db: SQLiteDatabase, snapshot: ProductsSnapshot): Promise<void> {
    return replaceCache(db, CACHE_KEYS.products, snapshot);
  },
  readPreferences(db: SQLiteDatabase): Promise<PreferencesResponse | null> {
    return readCache(db, CACHE_KEYS.preferences, isPreferences);
  },
  writePreferences(db: SQLiteDatabase, preferences: PreferencesResponse): Promise<void> {
    return replaceCache(db, CACHE_KEYS.preferences, preferences);
  },
  async readTheme(db: SQLiteDatabase): Promise<"light" | "dark" | null> {
    const value = await readCache(db, CACHE_KEYS.theme, (candidate): candidate is "light" | "dark" =>
      candidate === "light" || candidate === "dark",
    );
    return value;
  },
  writeTheme(db: SQLiteDatabase, theme: "light" | "dark"): Promise<void> {
    return replaceCache(db, CACHE_KEYS.theme, theme);
  },
};
