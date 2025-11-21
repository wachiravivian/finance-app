// src/utils/api.ts
import { Platform } from "react-native";

export function getApiBase() {
  // For web development - use localhost
  if (Platform.OS === 'web') {
    return "http://localhost:8800";
  }
  
  // For mobile - use your local IP
  return "http://192.168.100.44:8800";
}

export async function apiFetch(path: string, options?: RequestInit) {
  const base = getApiBase();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  console.log(`API Request: ${options?.method || "GET"} ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
      ...options,
    });

    if (!response.ok) {
      let errorMessage = `API Error ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        const text = await response.text();
        if (text) errorMessage = text;
      }
      throw new Error(errorMessage);
    }

    if (response.status === 204) return true;

    return await response.json();
  } catch (e: any) {
    console.error("Network error:", e);
    throw new Error(`Cannot connect to backend at ${url}. Make sure the server is running.`);
  }
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${getApiBase()}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}