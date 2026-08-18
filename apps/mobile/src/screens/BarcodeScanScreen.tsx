import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useIsFocused } from "@react-navigation/native";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, StyleSheet, View } from "react-native";
import { useT } from "shelf-sense-i18n/react";
import { api } from "../api/client";
import { AlertBanner, AppText, Button, IconButton } from "../components/ui";
import type { RootStackParamList } from "../navigation/types";
import { useProducts } from "../providers/ProductsProvider";
import { useAppTheme } from "../theme/ThemeProvider";
import { findProductByBarcode, resolveBarcodeDestination } from "../scanning/coordinator";

const barcodeTypes = ["qr", "ean13", "ean8", "code128", "code39", "upc_a", "upc_e"] as const;

export function BarcodeScanScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, "BarcodeScan">) {
  const { theme } = useAppTheme();
  const { t } = useT();
  const { products } = useProducts();
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [locked, setLocked] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [failedCode, setFailedCode] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener("change", (state) => setForeground(state === "active"));
    return () => { mounted.current = false; subscription.remove(); };
  }, []);

  const coordinate = useCallback(async (code: string) => {
    setLocked(true);
    setFailedCode(null);
    const local = findProductByBarcode(code, products);
    if (local) {
      navigation.replace("QuickEdit", { from: route.params.from, productId: local.id });
      return;
    }
    setLookingUp(true);
    try {
      const destination = await resolveBarcodeDestination(code, products, api.lookupBarcode);
      if (mounted.current && destination.route === "AddProduct") {
        navigation.replace("AddProduct", { from: route.params.from, barcode: destination.barcode, lookup: destination.lookup });
      }
    } catch {
      if (!mounted.current) return;
      setFailedCode(code);
      setLocked(true);
    } finally {
      if (mounted.current) setLookingUp(false);
    }
  }, [navigation, products, route.params.from]);

  const onScanned = useCallback(({ data }: BarcodeScanningResult) => {
    if (locked) return;
    void coordinate(data);
  }, [coordinate, locked]);

  const openManual = () => navigation.replace("AddProduct", { from: route.params.from });
  if (!permission) return <View style={[styles.center, { backgroundColor: theme.colors.surface0 }]}><ActivityIndicator color={theme.colors.brand500} /></View>;
  if (!permission.granted) {
    return <View style={[styles.center, { backgroundColor: theme.colors.surface0 }]}><AppText style={styles.heading}>{t("addProduct.scanOption.title")}</AppText><AppText style={styles.centerText}>{t("camera.permissionMessage")}</AppText>{permission.canAskAgain ? <Button label={t("camera.allow")} onPress={() => void requestPermission()} /> : <Button label={t("camera.openSettings")} onPress={() => void Linking.openSettings()} />}<Button label={t("camera.editManually")} variant="secondary" onPress={openManual} /></View>;
  }

  return (
    <View style={styles.screen}>
      <CameraView
        style={StyleSheet.absoluteFill}
        active={isFocused && foreground}
        barcodeScannerSettings={{ barcodeTypes: [...barcodeTypes] }}
        onBarcodeScanned={locked ? undefined : onScanned}
      />
      <View style={styles.overlay}>
        <View style={styles.topBar}><IconButton label={t("common.cancel")} icon="×" onPress={openManual} /><AppText style={styles.cameraTitle}>{t("addProduct.scanOption.title")}</AppText><View style={styles.spacer} /></View>
        <View style={styles.frame} accessibilityLabel={t("addProduct.lineUpBarcodeLabel")} />
        <View style={[styles.bottom, { backgroundColor: theme.colors.surface0 }]}>
          {lookingUp ? <View style={styles.progress}><ActivityIndicator color={theme.colors.brand500} /><AppText>{t("addProduct.lookingUpProduct")}</AppText></View> : failedCode ? <AlertBanner tone="danger">{t("camera.lookupFailed")}</AlertBanner> : <AppText style={styles.centerText}>{t("addProduct.lineUpBarcodeLabel")}</AppText>}
          {failedCode ? <View style={styles.actions}><Button label={t("common.tryAgain")} onPress={() => void coordinate(failedCode)} /><Button label={t("camera.editManually")} variant="secondary" onPress={openManual} /></View> : <Button label={t("camera.editManually")} variant="secondary" onPress={openManual} />}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: "#000" }, overlay: { flex: 1, justifyContent: "space-between", padding: 16, backgroundColor: "rgba(0,0,0,0.18)" }, topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 24 }, spacer: { width: 44 }, cameraTitle: { color: "#fff", fontSize: 20, fontWeight: "600" }, frame: { alignSelf: "center", width: "88%", aspectRatio: 1.55, borderWidth: 3, borderRadius: 16, borderColor: "#72d5cd", backgroundColor: "transparent" }, bottom: { borderRadius: 16, padding: 16, gap: 12, marginBottom: 16 }, center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 }, centerText: { textAlign: "center" }, heading: { fontSize: 24, fontWeight: "600" }, progress: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10 }, actions: { gap: 8 } });
