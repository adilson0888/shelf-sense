import { createContext, useCallback, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { ApiError, fetchProducts } from "./api";
import type { Batch, Product } from "shelf-sense-core"

/**
 * Shared product/batch state, lifted out of InventoryPage so a real
 * route (Stock Edit.md, at /products/:id/stock) can read and mutate the
 * same data without InventoryPage staying mounted.
 *
 * Seeded from a real apps/api GET /products call (see specs/Persistence.md)
 * rather than mocks/products.ts. Everything downstream of the initial load
 * — Quick Batch Edit, Product Edit, Stock Edit's mutations via
 * setProducts/setBatches — stays local-only for now; those flows don't have
 * real apps/api wiring yet per their own specs' current status.
 */
export interface ProductsStore {
  products: Product[];
  batches: Batch[];
  setProducts: Dispatch<SetStateAction<Product[]>>;
  setBatches: Dispatch<SetStateAction<Batch[]>>;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const ProductsContext = createContext<ProductsStore | null>(null);

export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchProducts()
      .then((data) => {
        if (cancelled) return;
        setProducts(data.products);
        setBatches(data.batches);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Couldn't load your pantry.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const refetch = useCallback(() => setReloadToken((t) => t + 1), []);

  return (
    <ProductsContext.Provider value={{ products, batches, setProducts, setBatches, loading, error, refetch }}>
      {children}
    </ProductsContext.Provider>
  );
}

export function useProductsStore(): ProductsStore {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error("useProductsStore must be used within a ProductsProvider");
  return ctx;
}
