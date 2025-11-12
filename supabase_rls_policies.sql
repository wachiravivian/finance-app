-- Supabase RLS Policies for Admin Dashboard
-- Run this in Supabase SQL Editor
--
-- IMPORTANT: Admin policies have been removed to prevent infinite recursion
-- Admin functionality should be implemented through:
-- 1. Database functions with SECURITY DEFINER
-- 2. Service role key for admin operations
-- 3. Custom admin endpoints in your application
-- 4. Manual database grants for admin users

-- Enable Row Level Security
alter table profiles enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;

-- Allow users to read their own profile
drop policy if exists "read own profile" on profiles;
create policy "read own profile" on profiles
for select using (id = auth.uid());

-- Allow users to update their own profile (for last_seen_at)
drop policy if exists "update own profile" on profiles;
create policy "update own profile" on profiles
for update using (id = auth.uid());

-- Allow users to insert their own profile
drop policy if exists "insert own profile" on profiles;
create policy "insert own profile" on profiles
for insert with check (id = auth.uid());

-- Allow admins to do everything on profiles
-- Note: Admin role check removed to prevent infinite recursion
-- Admins will need to be granted permissions through other means
drop policy if exists "admins manage profiles" on profiles;

-- Allow users to read their own transactions
drop policy if exists "users read own transactions" on transactions;
create policy "users read own transactions" on transactions
for select using (user_id = auth.uid());

-- Allow users to insert their own transactions
drop policy if exists "users insert own transactions" on transactions;
create policy "users insert own transactions" on transactions
for insert with check (user_id = auth.uid());

-- Allow users to update their own transactions
drop policy if exists "users update own transactions" on transactions;
create policy "users update own transactions" on transactions
for update using (user_id = auth.uid());

-- Allow users to delete their own transactions
drop policy if exists "users delete own transactions" on transactions;
create policy "users delete own transactions" on transactions
for delete using (user_id = auth.uid());

-- Allow users to read their own budgets
drop policy if exists "users read own budgets" on budgets;
create policy "users read own budgets" on budgets
for select using (user_id = auth.uid());

-- Allow users to insert their own budgets
drop policy if exists "users insert own budgets" on budgets;
create policy "users insert own budgets" on budgets
for insert with check (user_id = auth.uid());

-- Allow users to update their own budgets
drop policy if exists "users update own budgets" on budgets;
create policy "users update own budgets" on budgets
for update using (user_id = auth.uid());

-- Allow users to delete their own budgets
drop policy if exists "users delete own budgets" on budgets;
create policy "users delete own budgets" on budgets
for delete using (user_id = auth.uid());

-- Add last_seen_at column if it doesn't exist
alter table profiles add column if not exists last_seen_at timestamp with time zone;
