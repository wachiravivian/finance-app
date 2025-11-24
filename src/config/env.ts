// src/config/env.ts
export const validateEnvironment = () => {
  const required = {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  };

  const missing = Object.entries(required)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }

  // Validate URL format
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
    throw new Error('Invalid Supabase URL format. Must be: https://[project-ref].supabase.co');
  }

  // Validate key format (should be JWT-like)
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
  if (!key.startsWith('eyJ')) {
    console.warn('Supabase key may be invalid - should start with "eyJ"');
  }

  return true;
};

// Run validation
try {
  validateEnvironment();
  console.log('✅ Environment variables validated');
} catch (error: any) { // Fix: Type error as 'any' or use type guard
  console.error('❌ Environment validation failed:', error.message);
}

// Alternative with proper type guard:
// try {
//   validateEnvironment();
//   console.log('✅ Environment variables validated');
// } catch (error) {
//   if (error instanceof Error) {
//     console.error('❌ Environment validation failed:', error.message);
//   } else {
//     console.error('❌ Environment validation failed:', String(error));
//   }
// }