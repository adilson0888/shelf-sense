import { I18nProvider } from "shelf-sense-i18n/react";
import { loadLocale, type Dictionary, type Locale } from "shelf-sense-i18n";
import { getLocales } from "expo-localization";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePreferences } from "./PreferencesProvider";

function detectDeviceLocale(): Locale {
  return getLocales()[0]?.languageTag === "pt-BR" ? "pt-BR" : "en-US";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const { preferences } = usePreferences();
  const deviceLocale = useMemo(detectDeviceLocale, []);
  const locale = preferences.has_saved_preferences ? preferences.language : deviceLocale;
  const [loaded, setLoaded] = useState<{ locale: Locale; dict: Dictionary } | null>(null);

  useEffect(() => {
    let active = true;
    void loadLocale(locale).then((module) => {
      if (active) setLoaded({ locale, dict: module.default });
    });
    return () => {
      active = false;
    };
  }, [locale]);

  if (!loaded || loaded.locale !== locale) return null;
  return <I18nProvider locale={locale} dict={loaded.dict}>{children}</I18nProvider>;
}
