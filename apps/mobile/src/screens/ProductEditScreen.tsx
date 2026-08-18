import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { addAlias, addBarcode, armSave, buildEditProductPayload, buildSaveResult, canSave, cancelConfirm, changeBarcodeDesc, commitBarcodeDescEdit, confirmAliasMove, confirmBarcodeMove, isRenamed, newBarcodeValid, openProductEditState, removeAlias, removeSelectedBarcodes, saveSummary, setDoesExpire, setField, setNewAlias, setNewBarcodeCode, setNewBarcodeDesc, startEditBarcodeDesc, toggleAddBarcode, toggleBarcodeSelected, toggleSelectAllBarcodes } from "shelf-sense-core";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useT } from "shelf-sense-i18n/react";
import { api } from "../api/client";
import { AlertBanner, AppText, Button, ConfirmDialog, IconButton, SwitchField, TextField } from "../components/ui";
import type { RootStackParamList } from "../navigation/types";
import { useFeedback } from "../providers/FeedbackProvider";
import { useProducts } from "../providers/ProductsProvider";
import { useAppTheme } from "../theme/ThemeProvider";

export function ProductEditScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, "ProductEdit">) {
  const i18n = useT();
  const { theme } = useAppTheme();
  const { products, batches, commitSupportedSnapshot } = useProducts();
  const { showMessage } = useFeedback();
  const product = products.find((item) => item.id === route.params.productId);
  const [state, setState] = useState(() => product ? openProductEditState(product) : null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!product || !state) return null;
  const save = async () => {
    if (!state.saveArmed) { setState((current) => current ? armSave(current, products, i18n.t) : current); return; }
    setSaving(true);
    setError(null);
    try {
      const staged = buildSaveResult(state, product);
      const response = await api.updateProduct(product.id, buildEditProductPayload(staged));
      const effectByProduct = new Map(staged.otherProductUpdates.map((effect) => [effect.productId, effect]));
      const nextProducts = products.map((item) => {
        if (item.id === response.product.id) return response.product;
        const effect = effectByProduct.get(item.id);
        return effect ? { ...item, aliases: item.aliases.filter((alias) => !effect.removeAliases.includes(alias)), barcodes: item.barcodes.filter((barcode) => !effect.removeBarcodeCodes.includes(barcode.code)) } : item;
      });
      const nextBatches = [...batches.filter((batch) => batch.product_id !== product.id), ...response.batches];
      await commitSupportedSnapshot({ products: nextProducts, batches: nextBatches });
      showMessage(i18n.t("inventory.savedProductUpdated", { name: response.product.short_description }));
      navigation.navigate(route.params.from);
    } catch (caught) {
      setError(caught instanceof Error ? i18n.t(caught.message) : i18n.t("inventory.genericSaveError"));
    } finally {
      setSaving(false);
    }
  };
  const confirm = state.confirm;
  return <View style={[styles.screen, { backgroundColor: theme.colors.surface0 }]}><View style={[styles.appBar, { borderBottomColor: theme.colors.border }]}><IconButton label={i18n.t("productEdit.backTitle")} icon="←" onPress={() => navigation.navigate(route.params.from)} /><View style={styles.flex}><AppText style={styles.eyebrow}>{i18n.t("productEdit.eyebrow")}</AppText><AppText style={styles.title}>{state.short || i18n.t("productEdit.untitled")}</AppText></View></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}
    {isRenamed(state) ? <AlertBanner tone="info">{i18n.t("productEdit.renameNotice")}</AlertBanner> : null}
    <TextField label={i18n.t("common.shortDescriptionLabel")} value={state.short} onChangeText={(value) => setState((current) => current ? setField(current, "short", value) : current)} error={state.shortError} />
    <TextField label={i18n.t("common.longDescriptionLabel")} value={state.long} onChangeText={(value) => setState((current) => current ? setField(current, "long", value) : current)} multiline />
    <AppText style={styles.sectionTitle}>{i18n.t("productEdit.trackingHeading")}</AppText><View style={[styles.readOnly, { backgroundColor: theme.colors.surface2 }]}><AppText>{i18n.t("productEdit.trackingModeLabel")}</AppText><AppText>{i18n.t(state.trackingMode === "percentage" ? "addProduct.trackingModePercentage" : "addProduct.trackingModeUnits")}</AppText></View>
    {state.trackingMode === "percentage" ? <TextField label={i18n.t("addProduct.minimumPercentLabel")} value={state.minPercent} onChangeText={(value) => setState((current) => current ? setField(current, "minPercent", value) : current)} keyboardType="number-pad" /> : <><SwitchField label={i18n.t("common.doesItExpire")} value={state.doesExpire} onValueChange={(value) => setState((current) => current ? setDoesExpire(current, value) : current)} /><TextField label={i18n.t("common.minimumQuantityLabel")} value={state.minQty} onChangeText={(value) => setState((current) => current ? setField(current, "minQty", value) : current)} keyboardType="number-pad" />{state.doesExpire ? <TextField label={i18n.t("common.freshnessThresholdLabel")} value={state.fresh} onChangeText={(value) => setState((current) => current ? setField(current, "fresh", value) : current)} keyboardType="number-pad" /> : null}</>}
    <AppText style={styles.sectionTitle}>{i18n.t("productEdit.alsoKnownAsHeading")}</AppText>{state.aliases.map((alias) => <View key={alias} style={styles.aliasRow}><AppText style={styles.flex}>{alias}</AppText><IconButton label={i18n.t("common.remove")} icon="×" onPress={() => setState((current) => current ? removeAlias(current, alias) : current)} /></View>)}<View style={styles.inline}><View style={styles.flex}><TextField label={i18n.t("productEdit.addAliasPlaceholder")} value={state.newAlias} onChangeText={(value) => setState((current) => current ? setNewAlias(current, value) : current)} error={state.aliasError} /></View><Button label={i18n.t("productEdit.addAliasButton")} onPress={() => setState((current) => current ? addAlias(current, products, i18n.t) : current)} /></View>
    <AppText style={styles.sectionTitle}>{i18n.t("productEdit.barcodesHeading")}</AppText>{state.barcodes.length === 0 ? <AppText>{i18n.t("productEdit.noBarcodesLinked")}</AppText> : <><SwitchField label={i18n.t("common.selectAll")} value={state.selectedBarcodeIds.length === state.barcodes.length} onValueChange={() => setState((current) => current ? toggleSelectAllBarcodes(current) : current)} />{state.barcodes.map((barcode) => <View key={barcode.id} style={[styles.barcodeRow, { borderColor: theme.colors.border }]}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: state.selectedBarcodeIds.includes(barcode.id) }} onPress={() => setState((current) => current ? toggleBarcodeSelected(current, barcode.id) : current)}><AppText>{state.selectedBarcodeIds.includes(barcode.id) ? "☑" : "☐"}</AppText></Pressable><View style={styles.flex}>{state.editingBarcodeId === barcode.id ? <TextInput autoFocus value={barcode.description} onChangeText={(value) => setState((current) => current ? changeBarcodeDesc(current, barcode.id, value) : current)} onBlur={() => setState((current) => current ? commitBarcodeDescEdit(current) : current)} style={[styles.inlineInput, { color: theme.colors.inkPrimary, borderColor: theme.colors.brand500 }]} /> : <Pressable onPress={() => setState((current) => current ? startEditBarcodeDesc(current, barcode.id) : current)}><AppText>{barcode.description || i18n.t("productEdit.editDescriptionTitle")}</AppText></Pressable>}<AppText mono style={{ color: theme.colors.inkSecondary }}>{barcode.code}</AppText></View></View>)}<Button label={i18n.t("common.remove")} variant="danger" disabled={!state.selectedBarcodeIds.length} onPress={() => setState((current) => current ? removeSelectedBarcodes(current) : current)} /></>}
    <Button label={i18n.t("productEdit.addBarcodeToggle")} variant="secondary" onPress={() => setState((current) => current ? toggleAddBarcode(current) : current)} />{state.addBarcodeOpen ? <View style={styles.addCard}><TextField label={i18n.t("productEdit.barcodeDescriptionLabel")} value={state.newBarcodeDesc} onChangeText={(value) => setState((current) => current ? setNewBarcodeDesc(current, value) : current)} placeholder={i18n.t("productEdit.barcodeDescPlaceholder")} /><TextField label={i18n.t("productEdit.barcodeCodeLabel")} value={state.newBarcodeCode} onChangeText={(value) => setState((current) => current ? setNewBarcodeCode(current, value) : current)} placeholder={i18n.t("productEdit.barcodeCodePlaceholder")} keyboardType="number-pad" /><Button label={i18n.t("productEdit.addCodeButton")} disabled={!newBarcodeValid(state)} onPress={() => setState((current) => current ? addBarcode(current, products) : current)} /></View> : null}
  </ScrollView><View style={[styles.footer, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface0 }]}><View style={styles.flex}>{state.saveArmed ? <AppText>{saveSummary(state, i18n)}</AppText> : null}</View><Button label={i18n.t("common.cancel")} variant="secondary" onPress={() => navigation.navigate(route.params.from)} /><Button label={state.saveArmed ? i18n.t("common.confirmQuestion") : i18n.t("productEdit.saveChangesButton")} disabled={saving || !canSave(state)} onPress={() => void save()} /></View>
    <ConfirmDialog visible={Boolean(confirm)} title={i18n.t(confirm?.type === "alias" ? "productEdit.moveAliasTitle" : "common.moveBarcodeQuestion")} message={confirm?.type === "alias" ? i18n.t("productEdit.moveAliasBody", { alias: confirm.alias, ownerName: confirm.ownerName }) : i18n.t("productEdit.moveBarcodeBody", { ownerName: confirm?.ownerName ?? "" })} confirmLabel={i18n.t("common.unlinkAndContinue")} cancelLabel={i18n.t("common.cancel")} onConfirm={() => setState((current) => current ? (current.confirm?.type === "alias" ? confirmAliasMove(current) : confirmBarcodeMove(current)) : current)} onCancel={() => setState((current) => current ? cancelConfirm(current) : current)} />
  </View>;
}

const styles = StyleSheet.create({ flex: { flex: 1 }, screen: { flex: 1 }, appBar: { paddingTop: 28, minHeight: 84, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 8 }, eyebrow: { fontSize: 12, textTransform: "uppercase" }, title: { fontSize: 21, fontWeight: "600" }, content: { padding: 16, paddingBottom: 130, gap: 14 }, sectionTitle: { fontSize: 18, fontWeight: "600", marginTop: 8 }, readOnly: { minHeight: 48, borderRadius: 8, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, aliasRow: { minHeight: 44, flexDirection: "row", alignItems: "center" }, inline: { flexDirection: "row", alignItems: "flex-end", gap: 8 }, barcodeRow: { minHeight: 68, borderWidth: 1, borderRadius: 8, padding: 10, flexDirection: "row", alignItems: "center", gap: 10 }, inlineInput: { minHeight: 40, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8 }, addCard: { gap: 12 }, footer: { minHeight: 88, borderTopWidth: StyleSheet.hairlineWidth, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 } });
