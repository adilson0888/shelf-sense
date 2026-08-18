import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono/500Medium";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { SQLiteProvider } from "expo-sqlite";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useT } from "shelf-sense-i18n/react";
import { AlertBanner, AppText } from "./components/ui";
import { hasApiConfiguration } from "./config/env";
import { migrateDb } from "./db/migrate";
import { RootNavigator } from "./navigation/RootNavigator";
import { FeedbackProvider } from "./providers/FeedbackProvider";
import { LocaleProvider } from "./providers/LocaleProvider";
import { PreferencesProvider } from "./providers/PreferencesProvider";
import { ProductsProvider } from "./providers/ProductsProvider";
import { ThemeProvider, useAppTheme } from "./theme/ThemeProvider";

function ConfiguredApp() {
  const { theme } = useAppTheme();
  const { t } = useT();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface0 }}>
      <StatusBar style={theme.dark ? "light" : "dark"} />
      {hasApiConfiguration ? <ProductsProvider><FeedbackProvider><RootNavigator /></FeedbackProvider></ProductsProvider> : (
        <View style={styles.configuration}>
          <AppText mono style={styles.wordmark}>shelf·sense</AppText>
          <AlertBanner tone="danger">{t("configuration.apiUrlMissing")}</AlertBanner>
        </View>
      )}
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_600SemiBold, IBMPlexMono_500Medium });
  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName="shelfsense.db" onInit={migrateDb}>
        <ThemeProvider>
          <PreferencesProvider>
            <LocaleProvider>
              <ConfiguredApp />
            </LocaleProvider>
          </PreferencesProvider>
        </ThemeProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  configuration: { flex: 1, justifyContent: "center", padding: 24, gap: 24 },
  wordmark: { fontSize: 24, textAlign: "center" },
});
