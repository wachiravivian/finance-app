// src/utils/api.ts
import { Platform } from "react-native";

// Configuration
const BACKEND_CONFIG = {
  NGROK_URL: 'https://126ba19d0016.ngrok-free.app',
  LOCAL_PORT: 8080,
  TIMEOUT: 30000,
};

export function getApiBase(): string {
  // Always use ngrok URL
  if (BACKEND_CONFIG.NGROK_URL) {
    return BACKEND_CONFIG.NGROK_URL;
  }
  
  // Fallback for development
  if (Platform.OS === 'web') {
    return `http://localhost:${BACKEND_CONFIG.LOCAL_PORT}`;
  }
  
  if (Platform.OS === 'android' && __DEV__) {
    return `http://10.0.2.2:${BACKEND_CONFIG.LOCAL_PORT}`;
  }
  
  return `http://localhost:${BACKEND_CONFIG.LOCAL_PORT}`;
}

// Health check
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${getApiBase()}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      console.log('✅ Backend is online');
      return true;
    }
    return false;
  } catch (error) {
    console.log('❌ Backend health check failed:', error);
    return false;
  }
}

// Test connection
export async function testBackendConnection(): Promise<{success: boolean; message: string; url?: string}> {
  const base = getApiBase();
  
  try {
    const response = await fetch(`${base}/health`);
    
    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: `Backend connected successfully: ${data.message || 'Healthy'}`,
        url: base
      };
    } else {
      return {
        success: false,
        message: `Backend error: ${response.status} ${response.statusText}`,
        url: base
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: `Connection failed: ${error.message}`,
      url: base
    };
  }
}

// Test PDF password
export async function testPdfPassword(file: any, password: string): Promise<any> {
  const base = getApiBase();
  const endpoint = `${base}/test-pdf-password`;
  
  const formData = new FormData();
  
  if (Platform.OS === "web") {
    const response = await fetch(file.uri);
    const blob = await response.blob();
    formData.append("file", blob, "statement.pdf");
  } else {
    formData.append("file", {
      uri: file.uri,
      name: "statement.pdf",
      type: "application/pdf",
    } as any);
  }
  
  formData.append("password", password);

  const response = await fetch(endpoint, { 
    method: "POST", 
    body: formData,
  });

  return await response.json();
}

// Get backend config
export function getBackendConfig() {
  return {
    baseUrl: getApiBase(),
    usingNgrok: !!BACKEND_CONFIG.NGROK_URL,
    localPort: BACKEND_CONFIG.LOCAL_PORT,
    platform: Platform.OS,
    isDev: __DEV__,
  };
}

// API functions
export const api = {
  health: () => fetch(`${getApiBase()}/health`).then(r => r.json()),
  testML: () => fetch(`${getApiBase()}/test-ml`).then(r => r.json()),
  testPdfPassword: (file: any, password: string) => testPdfPassword(file, password),
};

export default api;