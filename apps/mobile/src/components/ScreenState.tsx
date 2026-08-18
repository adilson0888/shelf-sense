import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useT } from "shelf-sense-i18n/react";
import { useAppTheme } from "../theme/ThemeProvider";
import { AlertBanner, AppText, Button } from "./ui";

export function LoadingState({ label }: { label: string }) {
  const { theme } = useAppTheme();
  return <View style={styles.center}><ActivityIndicator color={theme.colors.brand500} /><AppText>{label}</AppText></View>;
}

export function BlockingError({ title, message, onRetry }: { title: string; message?: string | null; onRetry: () => void }) {
  const { t } = useT();
  return <View style={styles.center}><AppText style={styles.title}>{title}</AppText>{message ? <AppText>{message}</AppText> : null}<Button label={t("common.tryAgain")} onPress={onRetry} /></View>;
}

export function OfflineWarning({ onRetry }: { onRetry: () => void }) {
  const { t } = useT();
  return <AlertBanner tone="warning" action={<Button label={t("common.tryAgain")} variant="ghost" onPress={onRetry} />}>{t("offline.warning")}</AlertBanner>;
}

const styles = StyleSheet.create({ center: { flex: 1, minHeight: 240, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 }, title: { fontSize: 20, fontWeight: "600" } });
