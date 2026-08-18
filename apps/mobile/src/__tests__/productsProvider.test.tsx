import type { Product, ProductsSnapshot } from "shelf-sense-core";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ProductsProvider, useProducts } from "../providers/ProductsProvider";

const cachedProduct: Product = { id: "cached", short_description: "Cached rice", long_description: "", aliases: [], freshness_threshold_days: null, minimal_quantity: null, does_expire: false, barcodes: [], tracking_mode: "units", stock_percent: null, minimal_percentage: null };
const replacement: ProductsSnapshot = { products: [{ ...cachedProduct, id: "new", short_description: "Saved beans" }], batches: [] };
const mockReadProducts = jest.fn();
const mockWriteProducts = jest.fn();
const mockFetchProducts = jest.fn();
const mockDb = {};

jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => mockDb }));
jest.mock("../db/cacheRepository", () => ({ cacheRepository: { readProducts: (...args: unknown[]) => mockReadProducts(...args), writeProducts: (...args: unknown[]) => mockWriteProducts(...args) } }));
jest.mock("../api/client", () => ({ api: { fetchProducts: (...args: unknown[]) => mockFetchProducts(...args) } }));

beforeEach(() => {
  mockReadProducts.mockReset();
  mockWriteProducts.mockReset().mockResolvedValue(undefined);
  mockFetchProducts.mockReset();
});

test("cached Inventory remains visible and becomes retryable-offline when refresh rejects", async () => {
  mockReadProducts.mockResolvedValue({ products: [cachedProduct], batches: [] });
  mockFetchProducts.mockRejectedValue(new Error("errors.network"));
  const { result } = await renderHook(() => useProducts(), { wrapper: ProductsProvider });
  await waitFor(() => expect(result.current.products[0]?.short_description).toBe("Cached rice"));
  await waitFor(() => expect(result.current.offline).toBe(true));
  expect(result.current.error).toBe("errors.network");
});

test("supported snapshot commits replace memory and cache", async () => {
  mockReadProducts.mockResolvedValue({ products: [cachedProduct], batches: [] });
  mockFetchProducts.mockResolvedValue({ products: [cachedProduct], batches: [] });
  const { result } = await renderHook(() => useProducts(), { wrapper: ProductsProvider });
  await waitFor(() => expect(result.current.products[0]?.short_description).toBe("Cached rice"));
  await act(async () => result.current.commitSupportedSnapshot(replacement));
  expect(mockWriteProducts).toHaveBeenCalledWith(expect.anything(), replacement);
  expect(result.current.products[0]?.short_description).toBe("Saved beans");
});
