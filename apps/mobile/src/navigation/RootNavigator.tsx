import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SettingsScreen } from "../screens/SettingsScreen";
import { useAppTheme } from "../theme/ThemeProvider";
import { BarcodeScanScreen } from "../screens/BarcodeScanScreen";
import { AddProductScreen } from "../screens/AddProductScreen";
import { ProductEditScreen } from "../screens/ProductEditScreen";
import { QuickEditScreen } from "../screens/QuickEditScreen";
import { StockEditScreen } from "../screens/StockEditScreen";
import { GroceryScreen } from "../screens/GroceryScreen";
import { InventoryScreen } from "../screens/InventoryScreen";
import { ProductsScreen } from "../screens/ProductsScreen";
import type { RootStackParamList } from "./types";
const Stack = createNativeStackNavigator<RootStackParamList>();



export function RootNavigator() {
  const { theme } = useAppTheme();
  const baseTheme = theme.dark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: theme.colors.brand500,
      background: theme.colors.surface0,
      card: theme.colors.surface0,
      text: theme.colors.inkPrimary,
      border: theme.colors.border,
      notification: theme.colors.danger,
    },
  };
  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator initialRouteName="Inventory" screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.surface0 } }}>
        <Stack.Screen name="Inventory" component={InventoryScreen} />
        <Stack.Screen name="Products" component={ProductsScreen} />
        <Stack.Screen name="Grocery" component={GroceryScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="BarcodeScan" component={BarcodeScanScreen} />
        <Stack.Screen name="AddProduct" component={AddProductScreen} />
        <Stack.Screen name="ProductEdit" component={ProductEditScreen} />
        <Stack.Screen name="StockEdit" component={StockEditScreen} />
        <Stack.Screen name="QuickEdit" component={QuickEditScreen} options={{ presentation: "transparentModal", animation: "fade" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

