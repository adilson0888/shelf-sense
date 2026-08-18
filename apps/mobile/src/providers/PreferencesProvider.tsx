import type { PreferencesResponse, UpdatePreferencesPayload } from "shelf-sense-core";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSQLiteContext } from "expo-sqlite";
import { api } from "../api/client";
import { cacheRepository } from "../db/cacheRepository";

export const DEFAULT_PREFERENCES: PreferencesResponse = {
  ai_api_base_url: null,
  ai_api_key_set: false,
  ai_api_key_hint: null,
  ai_model: null,
  tavily_api_key_set: false,
  tavily_api_key_hint: null,
  default_minimal_quantity: 3,
  default_freshness_threshold_days: 7,
  default_does_expire: true,
  language: "en-US",
  default_minimal_percentage: 20,
  has_saved_preferences: false,
};

interface PreferencesContextValue {
  preferences: PreferencesResponse;
  loading: boolean;
  hasData: boolean;
  offline: boolean;
  error: string | null;
  refetch: () => void;
  save: (payload: UpdatePreferencesPayload) => Promise<PreferencesResponse>;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
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
      const cached = await cacheRepository.readPreferences(db);
      if (!active) return;
      if (cached) {
        setPreferences(cached);
        setHasData(true);
      }
      try {
        const fresh = await api.fetchPreferences();
        await cacheRepository.writePreferences(db, fresh);
        if (!active) return;
        setPreferences(fresh);
        setHasData(true);
        setOffline(false);
      } catch (caught) {
        if (!active) return;
        setOffline(Boolean(cached));
        setError(caught instanceof Error ? caught.message : "errors.preferencesLoad");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [db, reloadToken]);

  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);
  const save = useCallback(
    async (payload: UpdatePreferencesPayload) => {
      const updated = await api.updatePreferences(payload);
      await cacheRepository.writePreferences(db, updated);
      setPreferences(updated);
      setHasData(true);
      setOffline(false);
      return updated;
    },
    [db],
  );

  const value = useMemo(
    () => ({ preferences, loading, hasData, offline, error, refetch, save }),
    [preferences, loading, hasData, offline, error, refetch, save],
  );
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("usePreferences must be used inside PreferencesProvider");
  return value;
}
