-- Comprehensive Database Debug and Fix Script
-- Run this in Supabase SQL Editor to diagnose and fix all issues

-- Step 1: Check if tables exist
SELECT 
  schemaname, 
  tablename, 
  tableowner
FROM pg_tables 
WHERE tablename IN ('profiles', 'transactions', 'budgets')
ORDER BY tablename;

-- Step 2: Check if user exists in auth.users
SELECT 
  id, 
  email, 
  created_at,
  email_confirmed_at
FROM auth.users 
WHERE email = 'vivianwachuu@gmail.com';

-- Step 3: Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  display_name TEXT,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE
);

-- Step 4: Create transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 5: Create budgets table if it doesn't exist
CREATE TABLE IF NOT EXISTS budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 6: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Step 7: Drop all existing RLS policies to start fresh
DROP POLICY IF EXISTS "read own profile" ON profiles;
DROP POLICY IF EXISTS "update own profile" ON profiles;
DROP POLICY IF EXISTS "insert own profile" ON profiles;
DROP POLICY IF EXISTS "admins manage profiles" ON profiles;
DROP POLICY IF EXISTS "users read own transactions" ON transactions;
DROP POLICY IF EXISTS "users insert own transactions" ON transactions;
DROP POLICY IF EXISTS "users update own transactions" ON transactions;
DROP POLICY IF EXISTS "users delete own transactions" ON transactions;
DROP POLICY IF EXISTS "users read own budgets" ON budgets;
DROP POLICY IF EXISTS "users insert own budgets" ON budgets;
DROP POLICY IF EXISTS "users update own budgets" ON budgets;
DROP POLICY IF EXISTS "users delete own budgets" ON budgets;

-- Step 8: Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- Step 9: Create simple, non-recursive RLS policies
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "transactions_select_own" ON transactions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "transactions_insert_own" ON transactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "transactions_update_own" ON transactions
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "transactions_delete_own" ON transactions
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "budgets_select_own" ON budgets
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "budgets_insert_own" ON budgets
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "budgets_update_own" ON budgets
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "budgets_delete_own" ON budgets
  FOR DELETE USING (user_id = auth.uid());

-- Step 10: Create profile for vivianwachuu@gmail.com
INSERT INTO profiles (id, role, created_at)
SELECT 
  au.id,
  'admin',
  NOW()
FROM auth.users au
WHERE au.email = 'vivianwachuu@gmail.com'
AND NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = au.id
);

-- Step 11: Update existing profile to admin if it exists
UPDATE profiles 
SET role = 'admin', last_seen_at = NOW()
WHERE id = (
  SELECT au.id 
  FROM auth.users au 
  WHERE au.email = 'vivianwachuu@gmail.com'
)
AND role != 'admin';

-- Step 12: Verify everything is working
-- Check user exists
SELECT 
  'User Check' as check_type,
  au.id::text as auth_id,
  au.email,
  au.email_confirmed_at::text
FROM auth.users au
WHERE au.email = 'vivianwachuu@gmail.com';

-- Check profile exists
SELECT 
  'Profile Check' as check_type,
  p.id::text as auth_id,
  p.role as email,
  p.created_at::text as email_confirmed_at
FROM profiles p
JOIN auth.users au ON au.id = p.id
WHERE au.email = 'vivianwachuu@gmail.com';

-- Check RLS policies
SELECT 
  'RLS Policies Check' as check_type,
  COUNT(*)::text as auth_id,
  tablename as email,
  policyname as email_confirmed_at
FROM pg_policies 
WHERE tablename IN ('profiles', 'transactions', 'budgets')
GROUP BY tablename, policyname
ORDER BY tablename, policyname;
