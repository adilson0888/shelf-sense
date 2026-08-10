import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { useSQLiteContext } from "expo-sqlite";
import { insertScan, listScans, type ScanRow } from "./db";

/**
 * Walking skeleton — proves camera scanning + offline SQLite storage work
 * together end to end. Not a real screen yet; the first spec that touches
 * scanning should replace this, not grow it.
 */
export function ScanScreen() {
  const db = useSQLiteContext();
  const [permission, requestPermission] = useCameraPermissions();
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const scanLockedRef = useRef(false);

  const refresh = useCallback(async () => {
    setScans(await listScans(db));
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleScan = useCallback(
    async (result: BarcodeScanningResult) => {
      // Debounce: ignore new scans for a beat after one lands, so a single
      // barcode held in frame doesn't insert dozens of rows.
      if (scanLockedRef.current) return;
      scanLockedRef.current = true;
      setLastCode(result.data);
      await insertScan(db, result.data);
      await refresh();
      setTimeout(() => {
        scanLockedRef.current = false;
      }, 1200);
    },
    [db, refresh],
  );

  if (!permission) {
    return <View style={styles.center} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Camera access is needed to scan barcodes.</Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant permission</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{
            barcodeTypes: ["qr", "ean13", "ean8", "code128", "code39", "upc_a", "upc_e"],
          }}
          onBarcodeScanned={handleScan}
        />
        {lastCode && (
          <View style={styles.overlay}>
            <Text style={styles.overlayText}>Scanned: {lastCode}</Text>
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>Recent scans (offline, on-device)</Text>
      <FlatList
        style={styles.list}
        data={scans}
        keyExtractor={(row) => String(row.id)}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowCode}>{item.code}</Text>
            <Text style={styles.rowTime}>{new Date(item.scanned_at).toLocaleTimeString()}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.message}>No scans yet — point the camera at a barcode.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f8f8" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  cameraWrap: { height: "45%", backgroundColor: "#000" },
  overlay: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: "rgba(20,24,27,0.85)",
    borderRadius: 8,
    padding: 10,
  },
  overlayText: { color: "#fff", fontWeight: "600" },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: "#454c52", padding: 16, paddingBottom: 8 },
  list: { flex: 1, paddingHorizontal: 16 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e5e7",
  },
  rowCode: { fontFamily: "monospace", fontSize: 14, color: "#14181b" },
  rowTime: { fontSize: 12, color: "#767f86" },
  message: { textAlign: "center", color: "#767f86", padding: 16 },
  button: { backgroundColor: "#167d76", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  buttonText: { color: "#fff", fontWeight: "600" },
});
