import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { mockBatches, mockProducts } from "../mocks/products";
import type { Batch, Product } from "../types";

/**
 * Shared product/batch state, lifted out of ProductListPage so a real
 * route (Stock Edit.md, at /products/:id/stock) can read and mutate the
 * same data without ProductListPage staying mounted. Everything else about
 * this remains what it always was — apps/web's in-memory mock state, no
 * real apps/api wiring yet (see Product List.md's Non-functional section).
 */
export interface ProductsStore {
  products: Product[];
  batches: Batch[];
  setProducts: Dispatch<SetStateAction<Product[]>>;
  setBatches: Dispatch<SetStateAction<Batch[]>>;
}

const ProductsContext = createContext<ProductsStore | null>(null);

export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [batches, setBatches] = useState<Batch[]>(mockBatches);
  return <ProductsContext.Provider value={{ products, batches, setProducts, setBatches }}>{children}</ProductsContext.Provider>;
}

export function useProductsStore(): ProductsStore {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error("useProductsStore must be used within a ProductsProvider");
  return ctx;
}
