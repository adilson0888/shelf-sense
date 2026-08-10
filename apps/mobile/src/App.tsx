import { StatusBar } from "expo-status-bar";
import { SQLiteProvider } from "expo-sqlite";
import { migrateDb } from "./db";
import { ScanScreen } from "./ScanScreen";

export default function App() {
  return (
    <SQLiteProvider databaseName="shelfsense.db" onInit={migrateDb}>
      <StatusBar style="auto" />
      <ScanScreen />
    </SQLiteProvider>
  );
}
