-- FRESH START - SIMPLE DATABASE SETUP
-- Run this AFTER the complete_reset.sql script
-- This creates a minimal, working setup

-- Step 1: Create profiles table with minimal structure
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT DEFAULT 'user',
  display_name TEXT,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE
);

-- Step 2: Create transactions table
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Create budgets table
CREATE TABLE budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Create basic indexes
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_budgets_user_id ON budgets(user_id);

-- Step 5: Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- Step 6: Create VERY simple RLS policies (no recursion possible)
CREATE POLICY "profiles_policy" ON profiles
  FOR ALL USING (id = auth.uid());

CREATE POLICY "transactions_policy" ON transactions
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "budgets_policy" ON budgets
  FOR ALL USING (user_id = auth.uid());

-- Step 7: Create profile for vivianwachuu@gmail.com as admin
INSERT INTO profiles (id, role, created_at)
SELECT 
  au.id,
  'admin',
  NOW()
FROM auth.users au
WHERE au.email = 'vivianwachuu@gmail.com';

-- Step 8: Verify setup
SELECT 
  'Setup Complete' as status,
  p.id,
  p.role,
  p.created_at
FROM profiles p
JOIN auth.users au ON au.id = p.id
WHERE au.email = 'vivianwachuu@gmail.com';
