import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSQLiteContext } from "expo-sqlite";
import { cacheRepository } from "../db/cacheRepository";
import { darkTheme, lightTheme, type AppTheme } from "./tokens";

interface ThemeContextValue {
  theme: AppTheme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [mode, setMode] = useState<"light" | "dark">("dark");

  useEffect(() => {
    let active = true;
    void cacheRepository.readTheme(db).then((stored) => {
      if (active && stored) setMode(stored);
    });
    return () => {
      active = false;
    };
  }, [db]);

  const toggleTheme = useCallback(() => {
    setMode((current) => {
      const next = current === "dark" ? "light" : "dark";
      void cacheRepository.writeTheme(db, next);
      return next;
    });
  }, [db]);

  const value = useMemo(
    () => ({ theme: mode === "dark" ? darkTheme : lightTheme, toggleTheme }),
    [mode, toggleTheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useAppTheme must be used inside ThemeProvider");
  return value;
}
