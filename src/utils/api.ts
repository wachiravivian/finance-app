// src/utils/api.ts
import { Platform } from "react-native";

export function getApiBase() {
  const envBase = (global as any)?.process?.env?.EXPO_PUBLIC_API_BASE;
  if (envBase) return envBase;

  if (Platform.OS === "android") return "http://10.0.2.2:8000"; // Android emulator special host
  return "http://localhost:8000"; // Web/iOS sim default
}
