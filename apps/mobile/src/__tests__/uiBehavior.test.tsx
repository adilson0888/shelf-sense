import type { Dictionary } from "shelf-sense-i18n";
import { I18nProvider, useT } from "shelf-sense-i18n/react";
import { act, renderHook } from "@testing-library/react-native";
import { useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { createProductRowInteraction } from "../components/productRowInteraction";

const english: Dictionary = { "menu.inventory": "Inventory" };
const portuguese: Dictionary = { "menu.inventory": "Inventário" };
let chooseLanguage: Dispatch<SetStateAction<"en-US" | "pt-BR">>;

function LocaleHarness({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<"en-US" | "pt-BR">("en-US");
  chooseLanguage = setLocale;
  return <I18nProvider locale={locale} dict={locale === "en-US" ? english : portuguese}>{children}</I18nProvider>;
}

test("language choice rerenders visible labels immediately", async () => {
  const { result } = await renderHook(() => useT().t("menu.inventory"), { wrapper: LocaleHarness });
  expect(result.current).toBe("Inventory");
  await act(() => chooseLanguage("pt-BR"));
  expect(result.current).toBe("Inventário");
});

test("480ms long press opens Quick Edit without also expanding", () => {
  const onToggle = jest.fn();
  const onLongPress = jest.fn();
  const interaction = createProductRowInteraction(onToggle, onLongPress);
  interaction.longPress();
  interaction.press();
  expect(onLongPress).toHaveBeenCalledTimes(1);
  expect(onToggle).not.toHaveBeenCalled();
});
