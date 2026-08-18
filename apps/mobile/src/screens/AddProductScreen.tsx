import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import DateTimePicker from "@react-native-community/datetimepicker";
import { buildBlankForm, buildCreateProductPayload, buildLinkBarcodePayload, buildScannedForm, matchesSearch, type AddProductFormState, type Product } from "shelf-sense-core";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useT } from "shelf-sense-i18n/react";
import { api } from "../api/client";
import { AlertBanner, AppText, Button, ConfirmDialog, IconButton, SelectField, SwitchField, TextField } from "../components/ui";
import { useEnrichedProducts } from "../hooks/useEnrichedProducts";
import type { RootStackParamList } from "../navigation/types";
import { useFeedback } from "../providers/FeedbackProvider";
import { usePreferences } from "../providers/PreferencesProvider";
import { useProducts } from "../providers/ProductsProvider";
import { useAppTheme } from "../theme/ThemeProvider";

function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function AddProductScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, "AddProduct">) {
  const i18n = useT();
  const { theme } = useAppTheme();
  const { preferences } = usePreferences();
  const { products, batches, commitSupportedSnapshot } = useProducts();
  const { defaults } = useEnrichedProducts();
  const { showMessage } = useFeedback();
  const initial = route.params.barcode && route.params.lookup ? buildScannedForm(preferences.default_does_expire, route.params.barcode, route.params.lookup) : buildBlankForm(preferences.default_does_expire);
  const [form, setForm] = useState<AddProductFormState>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkQuery, setLinkQuery] = useState("");
  const [linkTarget, setLinkTarget] = useState<Product | null>(null);
  const linkResults = useMemo(() => products.filter((product) => matchesSearch(product, linkQuery)), [products, linkQuery]);
  const update = <Key extends keyof AddProductFormState>(key: Key, value: AddProductFormState[Key]) => setForm((current) => ({ ...current, [key]: value }));
  const positiveQuantity = Number.parseInt(form.qty, 10) > 0;
  const expiryMissing = form.trackingMode === "units" && form.doesExpire && positiveQuantity && !form.expiresOn;

  const returnToSource = (message: string) => {
    showMessage(message);
    navigation.navigate(route.params.from);
  };
  const save = async () => {
    if (expiryMissing || !form.short.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const result = await api.createProduct(buildCreateProductPayload(form, defaults));
      await commitSupportedSnapshot({ products: [...products, result.product], batches: result.batch ? [...batches, result.batch] : batches });
      returnToSource(i18n.t("inventory.productAdded"));
    } catch (caught) {
      setError(caught instanceof Error ? i18n.t(caught.message) : i18n.t("inventory.genericSaveError"));
    } finally {
      setSaving(false);
    }
  };
  const link = async () => {
    if (!linkTarget || !form.barcode) return;
    setSaving(true);
    setError(null);
    try {
      const result = await api.updateProduct(linkTarget.id, buildLinkBarcodePayload(linkTarget, form.barcode));
      const nextProducts = products.map((product) => product.id === result.product.id ? result.product : product);
      const nextBatches = [...batches.filter((batch) => batch.product_id !== result.product.id), ...result.batches];
      await commitSupportedSnapshot({ products: nextProducts, batches: nextBatches });
      returnToSource(i18n.t("addProduct.linkExistingSuccess", { name: result.product.short_description }));
    } catch (caught) {
      setLinkTarget(null);
      setError(caught instanceof Error ? i18n.t(caught.message) : i18n.t("addProduct.linkExistingError"));
    } finally {
      setSaving(false);
    }
  };

  return <View style={[styles.screen, { backgroundColor: theme.colors.surface0 }]}><View style={[styles.appBar, { borderBottomColor: theme.colors.border }]}><IconButton label={i18n.t("common.cancel")} icon="←" onPress={() => navigation.navigate(route.params.from)} /><View style={styles.flex}><AppText style={styles.eyebrow}>{i18n.t("addProduct.eyebrow")}</AppText><AppText style={styles.title}>{i18n.t("addProduct.productDetailsTitle")}</AppText></View></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    {form.barcode ? <AlertBanner tone="info">{form.prefillSource === "open-food-facts" ? i18n.t("addProduct.prefillNoteOpenFoodFacts") : form.prefillSource === "tavily" ? i18n.t("addProduct.prefillNoteTavily") : i18n.t("addProduct.prefillNoteNothingFound")}</AlertBanner> : null}
    {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}
    <TextField label={i18n.t("common.shortDescriptionLabel")} value={form.short} onChangeText={(value) => update("short", value)} placeholder={i18n.t("common.shortDescriptionPlaceholder")} error={!form.short.trim() ? i18n.t("common.shortDescriptionLabel") : null} />
    <TextField label={i18n.t("common.longDescriptionLabel")} value={form.long} onChangeText={(value) => update("long", value)} placeholder={i18n.t("common.longDescriptionPlaceholder")} multiline />
    <SelectField label={i18n.t("addProduct.trackingModeLabel")} value={form.trackingMode} onChange={(value) => update("trackingMode", value)} options={[{ value: "units", label: i18n.t("addProduct.trackingModeUnits") }, { value: "percentage", label: i18n.t("addProduct.trackingModePercentage") }]} />
    {form.trackingMode === "percentage" ? <><AlertBanner>{i18n.t("addProduct.percentageNoExpiryNote")}</AlertBanner><TextField label={i18n.t("addProduct.currentPercentLabel")} value={form.stockPercent} onChangeText={(value) => update("stockPercent", value)} keyboardType="number-pad" /><TextField label={i18n.t("addProduct.minimumPercentLabel")} value={form.minPercent} onChangeText={(value) => update("minPercent", value)} keyboardType="number-pad" placeholder={String(defaults.minimalPercentage)} /></> : <><SwitchField label={i18n.t("common.doesItExpire")} value={form.doesExpire} onValueChange={(value) => update("doesExpire", value)} /><TextField label={i18n.t("common.quantityLabel")} value={form.qty} onChangeText={(value) => update("qty", value)} keyboardType="number-pad" /><TextField label={i18n.t("common.minimumQuantityLabel")} value={form.minQty} onChangeText={(value) => update("minQty", value)} keyboardType="number-pad" placeholder={String(defaults.minimalQuantity)} />{form.doesExpire ? <TextField label={i18n.t("common.freshnessThresholdLabel")} value={form.fresh} onChangeText={(value) => update("fresh", value)} keyboardType="number-pad" placeholder={String(defaults.freshnessThresholdDays)} /> : null}{form.doesExpire && positiveQuantity ? <><Button label={form.expiresOn ? i18n.formatDate(form.expiresOn) : i18n.t("common.expiresOnLabel")} variant="secondary" onPress={() => setDateOpen(true)} />{expiryMissing ? <AppText style={{ color: theme.colors.danger }}>{i18n.t("common.expiresOnLabel")}</AppText> : null}</> : <AppText style={{ color: theme.colors.inkSecondary }}>{form.doesExpire ? i18n.t("addProduct.expiresOnHiddenWithExpiry") : i18n.t("addProduct.expiresOnHiddenNoExpiry")}</AppText>}</>}
    {dateOpen ? <DateTimePicker mode="date" value={form.expiresOn ? new Date(`${form.expiresOn}T12:00:00`) : new Date()} onChange={(_, date) => { setDateOpen(false); if (date) update("expiresOn", toDateOnly(date)); }} /> : null}
    {form.barcode ? <View style={styles.actions}><Button label={i18n.t("addProduct.linkExistingButton")} variant="secondary" onPress={() => setLinkOpen(true)} /><Button label={i18n.t("addProduct.clearAndStartBlank")} variant="ghost" onPress={() => setForm(buildBlankForm(preferences.default_does_expire))} /></View> : null}
    <Button label={saving ? i18n.t("common.saving") : i18n.t("addProduct.saveProductButton")} disabled={saving || expiryMissing || !form.short.trim()} onPress={() => void save()} />
  </ScrollView>
  <Modal visible={linkOpen} transparent animationType="slide" onRequestClose={() => setLinkOpen(false)}><Pressable style={styles.scrim} onPress={() => setLinkOpen(false)}><Pressable style={[styles.linkSheet, { backgroundColor: theme.colors.surface0 }]}><AppText style={styles.title}>{i18n.t("addProduct.linkExistingTitle")}</AppText><TextField label={i18n.t("addProduct.linkExistingSearchPlaceholder")} value={linkQuery} onChangeText={setLinkQuery} placeholder={i18n.t("addProduct.linkExistingSearchPlaceholder")} />{linkResults.length ? linkResults.map((product) => <Pressable key={product.id} onPress={() => setLinkTarget(product)} style={styles.linkRow}><AppText>{product.short_description}</AppText></Pressable>) : <AppText>{i18n.t("addProduct.linkExistingNoResults")}</AppText>}</Pressable></Pressable></Modal>
  <ConfirmDialog visible={Boolean(linkTarget)} title={i18n.t("addProduct.linkExistingConfirmTitle")} message={i18n.t("addProduct.linkExistingConfirmBody", { name: linkTarget?.short_description ?? "" })} confirmLabel={i18n.t("addProduct.linkExistingConfirmButton")} cancelLabel={i18n.t("common.cancel")} onConfirm={() => void link()} onCancel={() => setLinkTarget(null)} />
  </View>;
}

const styles = StyleSheet.create({ flex: { flex: 1 }, screen: { flex: 1 }, appBar: { paddingTop: 28, minHeight: 84, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 8 }, eyebrow: { fontSize: 12, textTransform: "uppercase" }, title: { fontSize: 21, fontWeight: "600" }, content: { padding: 16, paddingBottom: 48, gap: 16 }, actions: { gap: 8 }, scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }, linkSheet: { maxHeight: "75%", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, gap: 12 }, linkRow: { minHeight: 48, justifyContent: "center", paddingHorizontal: 12 } });
