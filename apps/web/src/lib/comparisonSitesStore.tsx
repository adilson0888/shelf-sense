import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  ApiError,
  createComparisonSite,
  deleteComparisonSite,
  fetchComparisonSites,
  updateComparisonSite,
  type ComparisonSite,
  type ComparisonSitePayload,
} from "./api";

/**
 * specs/Price comparison.md. Mirrors preferencesStore.tsx's Provider/
 * Context pattern — a single fetch-on-mount source of truth shared between
 * Settings (which manages the list) and Price History (which only reads
 * it, to gate the Search prices button). Add/edit/remove each hit the API
 * immediately and patch local state from the response — there's no
 * separate "Save" step for this list, unlike Settings' preferences form.
 */
export interface ComparisonSitesStore {
  sites: ComparisonSite[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  addSite: (payload: ComparisonSitePayload) => Promise<void>;
  editSite: (id: string, payload: ComparisonSitePayload) => Promise<void>;
  removeSite: (id: string) => Promise<void>;
}

const ComparisonSitesContext = createContext<ComparisonSitesStore | null>(null);

export function ComparisonSitesProvider({ children }: { children: ReactNode }) {
  const [sites, setSites] = useState<ComparisonSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchComparisonSites()
      .then(({ sites }) => {
        if (!cancelled) setSites(sites);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Couldn't load comparison sites.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const refetch = useCallback(() => setReloadToken((t) => t + 1), []);

  const addSite = useCallback(async (payload: ComparisonSitePayload) => {
    const { site } = await createComparisonSite(payload);
    setSites((s) => [...s, site]);
  }, []);

  const editSite = useCallback(async (id: string, payload: ComparisonSitePayload) => {
    const { site } = await updateComparisonSite(id, payload);
    setSites((s) => s.map((x) => (x.id === id ? site : x)));
  }, []);

  const removeSite = useCallback(async (id: string) => {
    await deleteComparisonSite(id);
    setSites((s) => s.filter((x) => x.id !== id));
  }, []);

  return (
    <ComparisonSitesContext.Provider value={{ sites, loading, error, refetch, addSite, editSite, removeSite }}>
      {children}
    </ComparisonSitesContext.Provider>
  );
}

export function useComparisonSitesStore(): ComparisonSitesStore {
  const ctx = useContext(ComparisonSitesContext);
  if (!ctx) throw new Error("useComparisonSitesStore must be used within a ComparisonSitesProvider");
  return ctx;
}
