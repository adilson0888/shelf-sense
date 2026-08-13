import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ApiError, fetchPreferences, updatePreferences, type PreferencesResponse, type UpdatePreferencesPayload } from "./api";

/**
 * Mirrors apps/web/src/lib/productsStore.tsx's ProductsProvider/
 * useProductsStore pattern — context + provider fetching on mount, no other
 * data-fetching library in this codebase. See specs/Settings.md's Data
 * section.
 *
 * Unlike ProductsStore, `preferences` is never null: its initial value
 * (before the GET resolves) is the same literal defaults as the DB schema's
 * column defaults, so callers like ProductList.tsx's initial
 * useState(buildBlankForm(...)) and enrichProduct(...) never need a
 * null-check while the fetch is in flight.
 */
export interface PreferencesStore {
  preferences: PreferencesResponse;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  save: (payload: UpdatePreferencesPayload) => Promise<void>;
}

const DEFAULT_PREFERENCES: PreferencesResponse = {
  ai_api_base_url: null,
  ai_api_key_set: false,
  ai_api_key_hint: null,
  ai_model: null,
  default_minimal_quantity: 3,
  default_freshness_threshold_days: 7,
  default_does_expire: true,
  language: "en-US",
};

const PreferencesContext = createContext<PreferencesStore | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<PreferencesResponse>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPreferences()
      .then((data) => {
        if (cancelled) return;
        setPreferences(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Couldn't load your settings.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const refetch = useCallback(() => setReloadToken((t) => t + 1), []);

  const save = useCallback(async (payload: UpdatePreferencesPayload) => {
    const updated = await updatePreferences(payload);
    setPreferences(updated);
  }, []);

  return (
    <PreferencesContext.Provider value={{ preferences, loading, error, refetch, save }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferencesStore(): PreferencesStore {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferencesStore must be used within a PreferencesProvider");
  return ctx;
}
