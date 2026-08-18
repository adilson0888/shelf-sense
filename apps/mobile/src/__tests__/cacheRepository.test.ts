import type { PreferencesResponse, ProductsSnapshot } from "shelf-sense-core";
import { cacheRepository } from "../db/cacheRepository";

const preferences: PreferencesResponse = { ai_api_base_url: null, ai_api_key_set: false, ai_api_key_hint: null, ai_model: null, tavily_api_key_set: false, tavily_api_key_hint: null, default_minimal_quantity: 3, default_freshness_threshold_days: 7, default_does_expire: true, language: "en-US", default_minimal_percentage: 20, has_saved_preferences: true };
const snapshot: ProductsSnapshot = { products: [], batches: [] };

test("malformed cached JSON is deleted and treated as a miss", async () => {
  const db = { getFirstAsync: jest.fn().mockResolvedValue({ value: "{broken" }), runAsync: jest.fn().mockResolvedValue(undefined) };
  await expect(cacheRepository.readProducts(db as never)).resolves.toBeNull();
  expect(db.runAsync).toHaveBeenCalledWith("DELETE FROM app_cache WHERE key = ?", "products_snapshot");
});

test("supported product and preferences snapshots atomically replace their cache keys", async () => {
  const db = { runAsync: jest.fn().mockResolvedValue(undefined) };
  await cacheRepository.writeProducts(db as never, snapshot);
  await cacheRepository.writePreferences(db as never, preferences);
  expect(db.runAsync).toHaveBeenNthCalledWith(1, expect.stringContaining("ON CONFLICT(key) DO UPDATE"), "products_snapshot", JSON.stringify(snapshot), expect.any(String));
  expect(db.runAsync).toHaveBeenNthCalledWith(2, expect.stringContaining("ON CONFLICT(key) DO UPDATE"), "preferences_snapshot", JSON.stringify(preferences), expect.any(String));
});
