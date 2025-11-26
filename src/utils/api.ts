// src/utils/api.ts - FIXED VERSION
import { Platform } from "react-native";

// Configuration - DYNAMIC DEBUGGING
const BACKEND_CONFIG = {
  LOCAL_PORT: 5000,
  // Try these different URLs - we'll test them all
  POSSIBLE_URLS: [
    "https://f53d82c42dea.ngrok-free.app", // ← REPLACE THIS WITH YOUR ACTUAL NGROK URL
    "http://localhost:5000",
    "http://10.0.2.2:5000", 
    "http://192.168.1.100:5000", // ← Replace with your computer's IP
  ],
  TIMEOUT: 15000,
};

// Global variable to store the working URL
let ACTIVE_BASE_URL: string | null = null;

export async function findWorkingBackendUrl(): Promise<string> {
  console.log('🕵️‍♂️ Searching for working backend URL...');
  
  // Test all possible URLs
  for (const url of BACKEND_CONFIG.POSSIBLE_URLS) {
    console.log(`🔍 Testing: ${url}`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log(`✅ Found working backend: ${url}`);
        ACTIVE_BASE_URL = url;
        return url;
      }
    } catch (error: any) {
      console.log(`❌ ${url} failed:`, error.message);
      continue;
    }
  }
  
  // If no URL works, use the first one as fallback
  const fallback = BACKEND_CONFIG.POSSIBLE_URLS[0];
  console.log(`⚠️ No working backend found, using fallback: ${fallback}`);
  ACTIVE_BASE_URL = fallback;
  return fallback;
}

export function getApiBase(): string {
  // If we already found a working URL, use it
  if (ACTIVE_BASE_URL) {
    return ACTIVE_BASE_URL;
  }
  
  // For initial load, use a reasonable default
  if (BACKEND_CONFIG.POSSIBLE_URLS[0] !== "https://f53d82c42dea.ngrok-free.app") {
    return BACKEND_CONFIG.POSSIBLE_URLS[0];
  }
  
  // Fallback logic
  if (Platform.OS === 'web') {
    return `http://localhost:${BACKEND_CONFIG.LOCAL_PORT}`;
  }
  
  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${BACKEND_CONFIG.LOCAL_PORT}`;
  }
  
  return `http://localhost:${BACKEND_CONFIG.LOCAL_PORT}`;
}

// Enhanced health check that tries multiple URLs
export async function checkBackendHealth(): Promise<{isOnline: boolean; workingUrl?: string; error?: string}> {
  try {
    console.log('🔍 Starting comprehensive backend health check...');
    
    const workingUrl = await findWorkingBackendUrl();
    
    // Test the found URL one more time to confirm
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(`${workingUrl}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      console.log('✅ Backend is online at:', workingUrl);
      return { isOnline: true, workingUrl };
    } else {
      console.log('❌ Backend responded with error:', response.status);
      return { 
        isOnline: false, 
        error: `HTTP ${response.status}: ${response.statusText}` 
      };
    }
  } catch (error: any) {
    console.log('❌ Comprehensive health check failed:', error.message);
    return { 
      isOnline: false, 
      error: error.message 
    };
  }
}

// Simple health check for TransactionsScreen (returns boolean)
export async function checkBackendHealthSimple(): Promise<boolean> {
  const result = await checkBackendHealth();
  return result.isOnline;
}

// Enhanced connection test
export async function testBackendConnection(): Promise<{
  success: boolean; 
  message: string; 
  url?: string;
  details?: any;
}> {
  console.log('🧪 Starting comprehensive connection test...');
  
  const healthResult = await checkBackendHealth();
  
  if (healthResult.isOnline && healthResult.workingUrl) {
    return {
      success: true,
      message: `✅ Connected successfully to: ${healthResult.workingUrl}`,
      url: healthResult.workingUrl,
      details: {
        method: 'auto-detected',
        testedUrls: BACKEND_CONFIG.POSSIBLE_URLS
      }
    };
  } else {
    return {
      success: false,
      message: `❌ Cannot connect to backend. ${healthResult.error || 'All connection attempts failed'}`,
      details: {
        testedUrls: BACKEND_CONFIG.POSSIBLE_URLS,
        error: healthResult.error,
        platform: Platform.OS,
        isDev: __DEV__
      }
    };
  }
}

// Get detailed backend config
export function getBackendConfig() {
  const baseUrl = getApiBase();
  return {
    baseUrl,
    activeUrl: ACTIVE_BASE_URL,
    localPort: BACKEND_CONFIG.LOCAL_PORT,
    platform: Platform.OS,
    isDev: __DEV__,
    possibleUrls: BACKEND_CONFIG.POSSIBLE_URLS,
    usingNgrok: baseUrl.includes('ngrok'),
    connectionMethod: ACTIVE_BASE_URL ? 'auto-detected' : 'fallback'
  };
}

// Test PDF password
export async function testPdfPassword(file: any, password: string): Promise<any> {
  const base = getApiBase();
  const endpoint = `${base}/test-pdf-password`;
  
  console.log(`🔐 Testing password at: ${endpoint}`);
  
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

export const api = {
  health: () => fetch(`${getApiBase()}/health`).then(r => r.json()),
  testML: () => fetch(`${getApiBase()}/test-ml`).then(r => r.json()),
  testPdfPassword: (file: any, password: string) => testPdfPassword(file, password),
};

export default api;