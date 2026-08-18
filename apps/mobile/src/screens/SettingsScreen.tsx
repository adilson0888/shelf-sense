import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PreferencesResponse, UpdatePreferencesPayload } from "shelf-sense-core";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useT } from "shelf-sense-i18n/react";
import { BlockingError, LoadingState, OfflineWarning } from "../components/ScreenState";
import { AlertBanner, AppText, Button, FooterWordmark, SectionHeader, SelectField, SwitchField, TextField } from "../components/ui";
import { AppShell } from "../navigation/AppShell";
import type { RootStackParamList } from "../navigation/types";
import { usePreferences } from "../providers/PreferencesProvider";
import { useAppTheme } from "../theme/ThemeProvider";

interface SettingsForm {
  aiApiBaseUrl: string;
  aiModel: string;
  defaultMinimalQuantity: string;
  defaultMinimalPercentage: string;
  defaultFreshnessThresholdDays: string;
  defaultDoesExpire: boolean;
  language: "en-US" | "pt-BR";
}

function formFrom(preferences: PreferencesResponse, locale: "en-US" | "pt-BR"): SettingsForm {
  return { aiApiBaseUrl: preferences.ai_api_base_url ?? "", aiModel: preferences.ai_model ?? "", defaultMinimalQuantity: String(preferences.default_minimal_quantity), defaultMinimalPercentage: String(preferences.default_minimal_percentage), defaultFreshnessThresholdDays: String(preferences.default_freshness_threshold_days), defaultDoesExpire: preferences.default_does_expire, language: locale };
}

function nonNegative(value: string): number | null {
  return /^\d+$/.test(value.trim()) ? Number.parseInt(value, 10) : null;
}

export function SettingsScreen({ navigation }: NativeStackScreenProps<RootStackParamList, "Settings">) {
  const i18n = useT();
  const { theme } = useAppTheme();
  const store = usePreferences();
  const [form, setForm] = useState(() => formFrom(store.preferences, i18n.locale));
  const [aiOpen, setAiOpen] = useState(true);
  const [defaultsOpen, setDefaultsOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [newApiKey, setNewApiKey] = useState("");
  const [clearApiKey, setClearApiKey] = useState(false);
  const [newTavilyKey, setNewTavilyKey] = useState("");
  const [clearTavilyKey, setClearTavilyKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => setForm(formFrom(store.preferences, i18n.locale)), [store.preferences, i18n.locale]);
  const setField = <Key extends keyof SettingsForm,>(key: Key, value: SettingsForm[Key]) => setForm((current) => ({ ...current, [key]: value }));
  const minQty = nonNegative(form.defaultMinimalQuantity);
  const minPercentValue = nonNegative(form.defaultMinimalPercentage);
  const minPercent = minPercentValue !== null && minPercentValue <= 100 ? minPercentValue : null;
  const freshDays = nonNegative(form.defaultFreshnessThresholdDays);
  const valid = minQty !== null && minPercent !== null && freshDays !== null && !saving;
  const save = async () => {
    if (minQty === null || minPercent === null || freshDays === null) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    const payload: UpdatePreferencesPayload = { ai_api_base_url: form.aiApiBaseUrl.trim() || null, ai_model: form.aiModel.trim() || null, default_minimal_quantity: minQty, default_minimal_percentage: minPercent, default_freshness_threshold_days: freshDays, default_does_expire: form.defaultDoesExpire, language: form.language, ...(newApiKey ? { ai_api_key: newApiKey } : clearApiKey ? { ai_api_key: null } : {}), ...(newTavilyKey ? { tavily_api_key: newTavilyKey } : clearTavilyKey ? { tavily_api_key: null } : {}) };
    try {
      await store.save(payload);
      setNewApiKey(""); setClearApiKey(false); setNewTavilyKey(""); setClearTavilyKey(false); setSaved(true);
    } catch (caught) {
      setSaveError(caught instanceof Error ? i18n.t(caught.message) : i18n.t("settings.saveErrorFallback"));
    } finally {
      setSaving(false);
    }
  };
  if (store.loading && !store.hasData) return <AppShell active="Settings" navigation={navigation}><LoadingState label={i18n.t("settings.loading")} /></AppShell>;
  if (!store.hasData && store.error) return <AppShell active="Settings" navigation={navigation}><BlockingError title={i18n.t("settings.loadError")} message={i18n.t(store.error)} onRetry={store.refetch} /></AppShell>;
  const sectionSave = <Button label={saving ? i18n.t("common.saving") : i18n.t("common.save")} disabled={!valid} onPress={() => void save()} />;
  return <AppShell active="Settings" navigation={navigation}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <AppText style={styles.heading}>{i18n.t("menu.settings")}</AppText>{store.offline ? <OfflineWarning onRetry={store.refetch} /> : null}{saved ? <AlertBanner tone="success">{i18n.t("settings.saved")}</AlertBanner> : null}{saveError ? <AlertBanner tone="danger">{saveError}</AlertBanner> : null}
    <View style={styles.section}><SectionHeader title={i18n.t("settings.aiSettings.heading")} open={aiOpen} onToggle={() => setAiOpen((value) => !value)} />{aiOpen ? <View style={styles.fields}><TextField label={i18n.t("settings.aiSettings.baseUrlLabel")} value={form.aiApiBaseUrl} onChangeText={(value) => setField("aiApiBaseUrl", value)} placeholder={i18n.t("settings.aiSettings.baseUrlPlaceholder")} /><TextField label={i18n.t("settings.aiSettings.apiKeyLabel")} value={newApiKey} secureTextEntry onChangeText={(value) => { setNewApiKey(value); if (value) setClearApiKey(false); }} />{store.preferences.ai_api_key_set && !newApiKey && !clearApiKey ? <View style={styles.hintRow}><AppText style={{ color: theme.colors.inkMuted }}>{i18n.t("settings.aiSettings.keySavedHint", { hint: store.preferences.ai_api_key_hint ?? "" })}</AppText><Pressable onPress={() => { setNewApiKey(""); setClearApiKey(true); }}><AppText style={{ color: theme.colors.brand500 }}>{i18n.t("settings.aiSettings.clearSavedKey")}</AppText></Pressable></View> : null}{clearApiKey ? <AppText>{i18n.t("settings.aiSettings.keyWillBeCleared")}</AppText> : null}<TextField label={i18n.t("settings.aiSettings.modelLabel")} value={form.aiModel} onChangeText={(value) => setField("aiModel", value)} placeholder={i18n.t("settings.aiSettings.modelPlaceholder")} /><TextField label={i18n.t("settings.aiSettings.tavilyApiKeyLabel")} value={newTavilyKey} secureTextEntry onChangeText={(value) => { setNewTavilyKey(value); if (value) setClearTavilyKey(false); }} />{store.preferences.tavily_api_key_set && !newTavilyKey && !clearTavilyKey ? <View style={styles.hintRow}><AppText style={{ color: theme.colors.inkMuted }}>{i18n.t("settings.aiSettings.keySavedHint", { hint: store.preferences.tavily_api_key_hint ?? "" })}</AppText><Pressable onPress={() => { setNewTavilyKey(""); setClearTavilyKey(true); }}><AppText style={{ color: theme.colors.brand500 }}>{i18n.t("settings.aiSettings.clearSavedKey")}</AppText></Pressable></View> : null}{clearTavilyKey ? <AppText>{i18n.t("settings.aiSettings.keyWillBeCleared")}</AppText> : null}<AppText style={{ color: theme.colors.inkMuted }}>{i18n.t("settings.aiSettings.tavilyApiKeyHint")}</AppText><View style={styles.saveRow}>{sectionSave}</View></View> : null}</View>
    <View style={[styles.section, { borderTopColor: theme.colors.border }]}><SectionHeader title={i18n.t("settings.defaultOptions.heading")} open={defaultsOpen} onToggle={() => setDefaultsOpen((value) => !value)} />{defaultsOpen ? <View style={styles.fields}><TextField label={i18n.t("settings.defaultOptions.minQtyLabel")} value={form.defaultMinimalQuantity} onChangeText={(value) => setField("defaultMinimalQuantity", value)} keyboardType="number-pad" error={minQty === null ? i18n.t("settings.defaultOptions.numberError") : null} /><TextField label={i18n.t("settings.defaultOptions.minPercentLabel")} value={form.defaultMinimalPercentage} onChangeText={(value) => setField("defaultMinimalPercentage", value)} keyboardType="number-pad" error={minPercent === null ? i18n.t("settings.defaultOptions.percentError") : null} /><AppText style={{ color: theme.colors.inkMuted }}>{i18n.t("settings.defaultOptions.minPercentHint")}</AppText><SwitchField label={i18n.t("settings.defaultOptions.expireByDefaultLabel")} value={form.defaultDoesExpire} onValueChange={(value) => setField("defaultDoesExpire", value)} />{form.defaultDoesExpire ? <TextField label={i18n.t("settings.defaultOptions.freshnessLabel")} value={form.defaultFreshnessThresholdDays} onChangeText={(value) => setField("defaultFreshnessThresholdDays", value)} keyboardType="number-pad" error={freshDays === null ? i18n.t("settings.defaultOptions.numberError") : null} /> : null}<View style={styles.saveRow}>{sectionSave}</View></View> : null}</View>
    <View style={[styles.section, { borderTopColor: theme.colors.border }]}><SectionHeader title={i18n.t("settings.userPreferences.heading")} open={prefsOpen} onToggle={() => setPrefsOpen((value) => !value)} />{prefsOpen ? <View style={styles.fields}><SelectField label={i18n.t("settings.userPreferences.languageLabel")} value={form.language} onChange={(value) => setField("language", value)} options={[{ value: "en-US", label: i18n.t("settings.languageOptions.enUS") }, { value: "pt-BR", label: i18n.t("settings.languageOptions.ptBR") }]} /><View style={styles.saveRow}>{sectionSave}</View></View> : null}</View><FooterWordmark />
  </ScrollView></AppShell>;
}

const styles = StyleSheet.create({ content: { padding: 16, paddingBottom: 48, gap: 16 }, heading: { fontSize: 28, fontWeight: "600" }, section: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 }, fields: { gap: 14, paddingBottom: 16 }, hintRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, saveRow: { flexDirection: "row", justifyContent: "flex-end" } });
