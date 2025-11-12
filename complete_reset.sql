-- COMPLETE DATABASE RESET SCRIPT
-- This will undo everything and start completely fresh
-- Run this in Supabase SQL Editor

-- Step 1: Drop ALL policies on all tables
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "read own profile" ON profiles;
DROP POLICY IF EXISTS "update own profile" ON profiles;
DROP POLICY IF EXISTS "insert own profile" ON profiles;
DROP POLICY IF EXISTS "admins manage profiles" ON profiles;
DROP POLICY IF EXISTS "users read own transactions" ON transactions;
DROP POLICY IF EXISTS "users insert own transactions" ON transactions;
DROP POLICY IF EXISTS "users update own transactions" ON transactions;
DROP POLICY IF EXISTS "users delete own transactions" ON transactions;
DROP POLICY IF EXISTS "transactions_select_own" ON transactions;
DROP POLICY IF EXISTS "transactions_insert_own" ON transactions;
DROP POLICY IF EXISTS "transactions_update_own" ON transactions;
DROP POLICY IF EXISTS "transactions_delete_own" ON transactions;
DROP POLICY IF EXISTS "users read own budgets" ON budgets;
DROP POLICY IF EXISTS "users insert own budgets" ON budgets;
DROP POLICY IF EXISTS "users update own budgets" ON budgets;
DROP POLICY IF EXISTS "users delete own budgets" ON budgets;
DROP POLICY IF EXISTS "budgets_select_own" ON budgets;
DROP POLICY IF EXISTS "budgets_insert_own" ON budgets;
DROP POLICY IF EXISTS "budgets_update_own" ON budgets;
DROP POLICY IF EXISTS "budgets_delete_own" ON budgets;

-- Step 2: Disable RLS on all tables
ALTER TABLE IF EXISTS profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS budgets DISABLE ROW LEVEL SECURITY;

-- Step 3: Drop all tables completely
DROP TABLE IF EXISTS budgets CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Step 4: Verify everything is clean
SELECT 
  'Cleanup Complete' as status,
  COUNT(*) as remaining_tables
FROM pg_tables 
WHERE tablename IN ('profiles', 'transactions', 'budgets');

-- Step 5: Show what policies remain (should be 0)
SELECT 
  'Remaining Policies' as status,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename IN ('profiles', 'transactions', 'budgets');
