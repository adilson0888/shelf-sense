import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import DateTimePicker from "@react-native-community/datetimepicker";
import { applyQuickEdit, bumpQuickEdit, commitQuickEditDraft, openQuickEditState, resetQuickEdit } from "shelf-sense-core";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useT } from "shelf-sense-i18n/react";
import { AppText, Button, IconButton } from "../components/ui";
import type { RootStackParamList } from "../navigation/types";
import { useProducts } from "../providers/ProductsProvider";
import { useAppTheme } from "../theme/ThemeProvider";

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function QuickEditScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, "QuickEdit">) {
  const i18n = useT();
  const { theme } = useAppTheme();
  const { products, batches, setProducts, setBatches } = useProducts();
  const product = products.find((candidate) => candidate.id === route.params.productId);
  const total = product?.tracking_mode === "percentage" ? product.stock_percent ?? 0 : batches.filter((batch) => batch.product_id === product?.id).reduce((sum, batch) => sum + batch.quantity, 0);
  const [state, setState] = useState(() => openQuickEditState(route.params.productId, total, product?.tracking_mode ?? "units"));
  const [dateOpen, setDateOpen] = useState(false);
  if (!product) return null;
  const delta = state.target - state.base;
  const needsExpiry = state.mode === "units" && delta > 0 && product.does_expire && !state.addExpiresOn;
  const steps = state.mode === "percentage" ? [-25, -10, -5, 5, 10, 25] : [-10, -5, -1, 1, 5, 10];
  const save = () => {
    if (needsExpiry) return;
    if (state.mode === "percentage") {
      setProducts((current) => current.map((item) => item.id === product.id ? { ...item, stock_percent: state.target } : item));
    } else {
      const own = batches.filter((batch) => batch.product_id === product.id);
      const updated = applyQuickEdit(own, product.id, product.does_expire, delta, state.addExpiresOn);
      setBatches((current) => [...current.filter((batch) => batch.product_id !== product.id), ...updated]);
    }
    navigation.navigate(route.params.from);
  };
  return <Pressable style={styles.scrim} onPress={() => navigation.navigate(route.params.from)}><Pressable style={[styles.sheet, { backgroundColor: theme.colors.surface0 }]} onPress={() => undefined}>
    <View style={styles.header}><View style={styles.flex}><AppText style={styles.eyebrow}>{i18n.t("common.quickBatchEditLabel")}</AppText><AppText style={styles.title}>{product.short_description}</AppText></View><IconButton label={i18n.t("common.cancel")} icon="×" onPress={() => navigation.navigate(route.params.from)} /></View>
    <AppText style={{ color: theme.colors.inkSecondary }}>{i18n.t("quickBatchEdit.inStockLabel")}</AppText>
    {state.editing ? <TextInput autoFocus accessibilityLabel={i18n.t("quickBatchEdit.typeExactQuantityTitle")} keyboardType="number-pad" value={state.draft} onChangeText={(draft) => setState((current) => ({ ...current, draft }))} onBlur={() => setState(commitQuickEditDraft)} onSubmitEditing={() => setState(commitQuickEditDraft)} style={[styles.totalInput, { color: theme.colors.inkPrimary, borderColor: theme.colors.brand500 }]} /> : <Pressable accessibilityRole="button" accessibilityLabel={i18n.t("quickBatchEdit.typeExactQuantityTitle")} onPress={() => setState((current) => ({ ...current, editing: true }))}><AppText mono style={styles.total}>{state.target}{state.mode === "percentage" ? "%" : ""}</AppText></Pressable>}
    <View style={styles.steps}>{steps.map((step) => <Button key={step} label={step > 0 ? `+${step}` : String(step)} variant="secondary" onPress={() => setState((current) => bumpQuickEdit(current, step))} />)}</View>
    <AppText style={{ color: theme.colors.inkSecondary }}>{state.mode === "percentage" ? i18n.t("quickBatchEdit.percentHint") : delta < 0 ? i18n.t("quickBatchEdit.decHintNegative", { count: Math.abs(delta) }) : delta > 0 ? i18n.t("quickBatchEdit.decHintPositive", { count: delta }) : i18n.t("quickBatchEdit.decHintDefault")}</AppText>
    {state.mode === "units" && delta > 0 && product.does_expire ? <><Button label={state.addExpiresOn ? i18n.formatDate(state.addExpiresOn) : i18n.t("common.expiresOnLabel")} variant="secondary" onPress={() => setDateOpen(true)} />{needsExpiry ? <AppText style={{ color: theme.colors.danger }}>{i18n.t("common.expiresOnLabel")}</AppText> : null}</> : null}
    {dateOpen ? <DateTimePicker mode="date" value={state.addExpiresOn ? new Date(`${state.addExpiresOn}T12:00:00`) : new Date()} onValueChange={(_, date) => { setDateOpen(false); setState((current) => ({ ...current, addExpiresOn: dateOnly(date) })); }} onDismiss={() => setDateOpen(false)} /> : null}
    <View style={styles.links}><Button label={i18n.t("quickBatchEdit.stockButton")} variant="ghost" disabled={state.mode === "percentage"} onPress={() => navigation.replace("StockEdit", { productId: product.id })} /><Button label={i18n.t("quickBatchEdit.editProductButton")} variant="ghost" onPress={() => navigation.replace("ProductEdit", { from: route.params.from, productId: product.id })} /></View>
    <View style={styles.footer}><Button label={i18n.t("quickBatchEdit.resetButton")} variant="ghost" onPress={() => setState(resetQuickEdit)} /><View style={styles.flex} /><Button label={i18n.t("common.cancel")} variant="secondary" onPress={() => navigation.navigate(route.params.from)} /><Button label={i18n.t("common.save")} disabled={needsExpiry} onPress={save} /></View>
  </Pressable></Pressable>;
}

const styles = StyleSheet.create({ flex: { flex: 1 }, scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.58)", justifyContent: "flex-end" }, sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 14 }, header: { flexDirection: "row", alignItems: "center", gap: 8 }, eyebrow: { fontSize: 12, textTransform: "uppercase" }, title: { fontSize: 21, fontWeight: "600" }, total: { fontSize: 44, textAlign: "center" }, totalInput: { minHeight: 64, borderWidth: 2, borderRadius: 8, fontSize: 36, textAlign: "center" }, steps: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 }, links: { flexDirection: "row", justifyContent: "space-between", gap: 8 }, footer: { flexDirection: "row", alignItems: "center", gap: 8 } });
