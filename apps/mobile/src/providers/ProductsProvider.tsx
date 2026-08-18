import type { Batch, Product, ProductsSnapshot } from "shelf-sense-core";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useSQLiteContext } from "expo-sqlite";
import { api } from "../api/client";
import { cacheRepository } from "../db/cacheRepository";

interface ProductsContextValue {
  products: Product[];
  batches: Batch[];
  setProducts: Dispatch<SetStateAction<Product[]>>;
  setBatches: Dispatch<SetStateAction<Batch[]>>;
  loading: boolean;
  hasData: boolean;
  offline: boolean;
  error: string | null;
  refetch: () => void;
  commitSupportedSnapshot: (snapshot: ProductsSnapshot) => Promise<void>;
}

const ProductsContext = createContext<ProductsContextValue | null>(null);

export function ProductsProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void (async () => {
      const cached = await cacheRepository.readProducts(db);
      if (!active) return;
      if (cached) {
        setProducts(cached.products);
        setBatches(cached.batches);
        setHasData(true);
      }
      try {
        const fresh = await api.fetchProducts();
        await cacheRepository.writeProducts(db, fresh);
        if (!active) return;
        setProducts(fresh.products);
        setBatches(fresh.batches);
        setHasData(true);
        setOffline(false);
      } catch (caught) {
        if (!active) return;
        setOffline(Boolean(cached));
        setError(caught instanceof Error ? caught.message : "errors.productsLoad");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [db, reloadToken]);

  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);
  const commitSupportedSnapshot = useCallback(
    async (snapshot: ProductsSnapshot) => {
      await cacheRepository.writeProducts(db, snapshot);
      setProducts(snapshot.products);
      setBatches(snapshot.batches);
      setHasData(true);
      setOffline(false);
    },
    [db],
  );

  const value = useMemo(
    () => ({
      products,
      batches,
      setProducts,
      setBatches,
      loading,
      hasData,
      offline,
      error,
      refetch,
      commitSupportedSnapshot,
    }),
    [products, batches, loading, hasData, offline, error, refetch, commitSupportedSnapshot],
  );
  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
}

export function useProducts(): ProductsContextValue {
  const value = useContext(ProductsContext);
  if (!value) throw new Error("useProducts must be used inside ProductsProvider");
  return value;
}
