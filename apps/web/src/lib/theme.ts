import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "ss-theme";

/**
 * The "dark" class lives on <html>, not a React-rendered wrapper — see
 * index.html's comment for why (a mobile Safari safe-area edge case needs
 * it at the document root). index.html's own inline script sets the
 * *initial* class before React hydrates, to avoid a flash of the wrong
 * theme; this hook is what keeps it in sync after that, on every toggle.
 */
export function getStoredTheme(): Theme {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" ? "light" : "dark";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  window.localStorage.setItem(STORAGE_KEY, theme);
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return {
    theme,
    toggleTheme: () => setTheme((current) => (current === "dark" ? "light" : "dark")),
  };
}
