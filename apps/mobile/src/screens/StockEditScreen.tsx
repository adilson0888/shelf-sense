import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import DateTimePicker from "@react-native-community/datetimepicker";
import { addBatch, armStockSave, canAddBatch, commitExpEdit, commitQtyEdit, expDraftChange, hasPendingChanges, isEditedRow, isNewRow, newExpChange, newQtyChange, openStockEditState, qtyDraftChange, removeSelected, stageRemoval, startEditExp, startEditQty, stockEditSaveSummary, toggleAddOpen, toggleSelectAll, toggleSelected } from "shelf-sense-core";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useT } from "shelf-sense-i18n/react";
import { AppText, Button, IconButton, SwitchField, TextField } from "../components/ui";
import type { RootStackParamList } from "../navigation/types";
import { useProducts } from "../providers/ProductsProvider";
import { useAppTheme } from "../theme/ThemeProvider";

const dateOnly = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function StockEditScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, "StockEdit">) {
  const i18n = useT();
  const { theme } = useAppTheme();
  const { products, batches, setBatches } = useProducts();
  const product = products.find((item) => item.id === route.params.productId);
  const [state, setState] = useState(() => openStockEditState(route.params.productId, batches.filter((batch) => batch.product_id === route.params.productId)));
  const [dateTarget, setDateTarget] = useState<"new" | string | null>(null);
  if (!product || product.tracking_mode === "percentage") return null;
  const save = () => {
    if (!hasPendingChanges(state)) return navigation.navigate("Inventory");
    if (!state.armed) { setState(armStockSave); return; }
    setBatches((current) => [...current.filter((batch) => batch.product_id !== product.id), ...state.batches]);
    navigation.navigate("Inventory");
  };
  return <View style={[styles.screen, { backgroundColor: theme.colors.surface0 }]}><View style={[styles.appBar, { borderBottomColor: theme.colors.border }]}><IconButton label={i18n.t("stockEdit.backToInventory")} icon="←" onPress={() => navigation.navigate("Inventory")} /><View><AppText style={styles.eyebrow}>{i18n.t("stockEdit.eyebrow")}</AppText><AppText style={styles.title}>{product.short_description}</AppText></View></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <View style={styles.toolbar}><SwitchField label={i18n.t("common.selectAll")} value={state.batches.length > 0 && state.sel.length === state.batches.length} onValueChange={() => setState(toggleSelectAll)} /><Button label={i18n.t("common.remove")} variant="danger" disabled={!state.sel.length} onPress={() => setState(removeSelected)} /></View>
    {state.batches.length === 0 ? <View style={styles.empty}><AppText>{i18n.t("stockEdit.noStockHint")}</AppText></View> : state.batches.map((batch) => <View key={batch.id} style={[styles.row, { borderColor: theme.colors.border }]}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: state.sel.includes(batch.id) }} onPress={() => setState((current) => toggleSelected(current, batch.id))} style={styles.check}><AppText>{state.sel.includes(batch.id) ? "☑" : "☐"}</AppText></Pressable><View style={styles.flex}>{state.editingQtyId === batch.id ? <TextInput autoFocus keyboardType="number-pad" value={state.qtyDraft} onChangeText={(value) => setState((current) => qtyDraftChange(current, value))} onBlur={() => setState((current) => commitQtyEdit(current, batch.id))} style={[styles.inlineInput, { color: theme.colors.inkPrimary, borderColor: theme.colors.brand500 }]} /> : <Pressable onPress={() => setState((current) => startEditQty(current, batch.id, batch.quantity))}><AppText mono>{batch.quantity}</AppText></Pressable>}<Pressable onPress={() => { setState((current) => startEditExp(current, batch.id, batch.expires_on)); setDateTarget(batch.id); }}><AppText>{batch.expires_on ? i18n.formatDate(batch.expires_on) : i18n.t("freshness.doesNotExpire")}</AppText></Pressable><View style={styles.badges}>{isNewRow(state, batch.id) ? <AppText>{i18n.t("stockEdit.newBadge")}</AppText> : isEditedRow(state, batch.id) ? <AppText>{i18n.t("stockEdit.editedBadge")}</AppText> : null}</View></View><IconButton label={i18n.t("common.remove")} icon="×" onPress={() => setState((current) => stageRemoval(current, batch.id))} /></View>)}
    <Button label={i18n.t("stockEdit.addBatchButton")} variant="secondary" onPress={() => setState(toggleAddOpen)} />
    {state.addOpen ? <View style={[styles.addCard, { borderColor: theme.colors.border }]}><TextField label={i18n.t("common.quantityLabel")} value={state.newQty} onChangeText={(value) => setState((current) => newQtyChange(current, value))} keyboardType="number-pad" placeholder={i18n.t("stockEdit.quantityPlaceholder")} />{product.does_expire ? <Button label={state.newExp ? i18n.formatDate(state.newExp) : i18n.t("stockEdit.expirationDateLabel")} variant="secondary" onPress={() => setDateTarget("new")} /> : <AppText>{i18n.t("stockEdit.noExpiryTrackingHint")}</AppText>}<Button label={i18n.t("stockEdit.addBatchButton")} disabled={!canAddBatch(state, product.does_expire)} onPress={() => setState((current) => addBatch(current, product.does_expire))} /></View> : null}
    {dateTarget ? <DateTimePicker mode="date" value={new Date()} onChange={(_, date) => { const target = dateTarget; setDateTarget(null); if (!date) return; if (target === "new") setState((current) => newExpChange(current, dateOnly(date))); else setState((current) => commitExpEdit(expDraftChange(current, dateOnly(date)), target)); }} /> : null}
  </ScrollView><View style={[styles.footer, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface0 }]}><View style={styles.flex}>{state.armed ? <AppText>{stockEditSaveSummary(state, i18n)}</AppText> : null}</View><Button label={i18n.t("common.cancel")} variant="secondary" onPress={() => navigation.navigate("Inventory")} /><Button label={state.armed ? i18n.t("common.confirmQuestion") : i18n.t("common.save")} onPress={save} /></View></View>;
}

const styles = StyleSheet.create({ flex: { flex: 1 }, screen: { flex: 1 }, appBar: { paddingTop: 28, minHeight: 84, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 8 }, eyebrow: { fontSize: 12, textTransform: "uppercase" }, title: { fontSize: 21, fontWeight: "600" }, content: { padding: 16, paddingBottom: 120, gap: 12 }, toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, row: { minHeight: 76, borderWidth: 1, borderRadius: 10, padding: 10, flexDirection: "row", alignItems: "center", gap: 10 }, check: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, inlineInput: { minHeight: 40, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8 }, badges: { flexDirection: "row", gap: 8 }, empty: { minHeight: 140, justifyContent: "center", alignItems: "center" }, addCard: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 12 }, footer: { minHeight: 80, borderTopWidth: StyleSheet.hairlineWidth, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 } });
