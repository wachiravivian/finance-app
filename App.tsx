import "react-native-gesture-handler"; // MUST be first
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AppNavigator from "./src/navigation/AppNavigator";
import ErrorBoundary from "./src/components/ErrorBoundary";
import { ThemeProvider } from "./src/contexts/ThemeContext";


// inside AppNavigator()
import { useTheme } from "./src/hooks/useTheme";
import { DarkTheme, DefaultTheme } from "@react-navigation/native";
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <ThemeProvider>
            <AppNavigator />
          </ThemeProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}