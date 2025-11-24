// src/supabaseClient.ts
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

// --- ENV VALIDATION ---
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔐 Supabase Config Check:', {
  hasUrl: !!SUPABASE_URL,
  urlLength: SUPABASE_URL?.length,
  hasKey: !!SUPABASE_ANON_KEY,
  platform: Platform.OS,
});

if (!SUPABASE_URL)
  throw new Error('EXPO_PUBLIC_SUPABASE_URL is not defined. Check your .env file');
if (!SUPABASE_ANON_KEY)
  throw new Error('EXPO_PUBLIC_SUPABASE_ANON_KEY is not defined. Check your .env file');
if (!SUPABASE_URL.startsWith('https://'))
  throw new Error('SUPABASE_URL must start with https://');
if (!SUPABASE_URL.includes('.supabase.co'))
  throw new Error('SUPABASE_URL must be a valid Supabase URL ending with .supabase.co');

// --- SESSION CLEAR UTILITY ---
export const clearAuthSession = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const authKeys = keys.filter(k => k.includes('sb-') && k.includes('auth-token'));
    await AsyncStorage.multiRemove(authKeys);
    console.log('🔐 Cleared auth sessions:', authKeys);
  } catch (err) {
    console.error('🔐 Error clearing session:', err);
  }
};

// --- CUSTOM FETCH WITH TIMEOUT + AUTH CLEANUP ---
const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input.toString();
  console.log(`🔄 Supabase Request: ${init?.method || 'GET'} ${url}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.clone().text();
      console.error(`❌ HTTP Error ${response.status}: ${errorText}`);

      if (response.status === 401 || response.status === 403) {
        if (errorText.includes('session_not_found') || errorText.includes('JWT'))
          await clearAuthSession();
      }

      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response;
  } catch (error: any) {
    console.error('❌ Network Request Failed:', {
      error: error.message,
      url,
      method: init?.method,
    });

    if (error.name === 'AbortError')
      throw new Error('Network request timeout. Please check your internet connection.');
    throw error;
  }
};

// --- SUPABASE CLIENT CREATION ---
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storage: AsyncStorage,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
    debug: __DEV__,
  },
  global: {
    fetch: customFetch,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// --- AUTH STATE CHANGE HANDLER ---
if (__DEV__) {
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('🔐 Auth State Change:', event, {
      hasSession: !!session,
      user: session?.user?.email,
      userId: session?.user?.id,
    });

    if (event === 'SIGNED_OUT') clearAuthSession();
  });
}

// --- SESSION VALIDATION ---
export const getValidSession = async () => {
  try {
    console.log('🔐 Checking for valid session...');
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('🔐 Session check error:', error);
      await clearAuthSession();
      return null;
    }

    if (!session || (session.expires_at && session.expires_at < Date.now() / 1000)) {
      console.log('🔐 No valid session or session expired.');
      await clearAuthSession();
      return null;
    }

    console.log('✅ Valid session for:', session.user?.email);
    return session;
  } catch (error) {
    console.error('🔐 Error checking session:', error);
    return null;
  }
};

// --- USER RETRIEVAL ---
export const getCurrentUser = async () => {
  const session = await getValidSession();
  if (!session?.user) throw new Error('User not authenticated');
  console.log('✅ Current user:', session.user.email);
  return session.user;
};

// --- SIGN-IN FUNCTION ---
export const enhancedSignIn = async (email: string, password: string) => {
  await clearAuthSession();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw new Error(error.message || 'Sign in failed');
  console.log('✅ Sign in successful:', data.user?.email);
  return data;
};

// --- SIGN-UP FUNCTION ---
export const enhancedSignUp = async (email: string, password: string, metadata?: any) => {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: metadata },
  });
  if (error) throw new Error(error.message || 'Sign up failed');
  console.log('✅ Sign up successful:', data.user?.email);
  return data;
};

// --- SIGN OUT ---
export const enhancedSignOut = async () => {
  console.log('🔐 Signing out...');
  const { error } = await supabase.auth.signOut();
  await clearAuthSession();
  if (error) throw error;
  console.log('✅ Sign out successful');
};

// --- REFRESH SESSION ---
export const refreshSession = async () => {
  console.log('🔐 Refreshing session...');
  const { data: { session }, error } = await supabase.auth.refreshSession();
  if (error || !session) {
    await clearAuthSession();
    throw error || new Error('No session after refresh');
  }
  console.log('✅ Session refreshed for:', session.user?.email);
  return session;
};

// --- INITIALIZATION ---
export const initializeSupabase = async () => {
  console.log('🚀 Initializing Supabase...');
  const session = await getValidSession();
  if (session) console.log('🔐 Existing session found:', session.user?.email);
  else console.log('🔐 No existing session found');
  return supabase;
};

// --- QUICK AUTH STATUS ---
export const checkAuthStatus = async () => {
  try {
    const user = await getCurrentUser();
    return { isAuthenticated: true, user, error: null };
  } catch (error: any) {
    return { isAuthenticated: false, user: null, error: error.message };
  }
};

// Initialize on load (web only)
if (typeof window !== 'undefined') {
  initializeSupabase().catch(err => console.error('Initialization error:', err));
}

export default supabase;
