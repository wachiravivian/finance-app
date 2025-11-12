-- Quick debug script - run this in Supabase SQL Editor
-- This will show us exactly what's in the database

-- Check if the user exists in auth.users
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'vivianwachuu@gmail.com';

-- Check if profile exists and what role it has
SELECT p.id, p.role, p.created_at, p.last_seen_at
FROM profiles p
JOIN auth.users au ON au.id = p.id
WHERE au.email = 'vivianwachuu@gmail.com';

-- Check RLS policies on profiles table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'profiles';

-- Force update the role to admin (this will work regardless of RLS)
UPDATE profiles 
SET role = 'admin', last_seen_at = NOW()
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'vivianwachuu@gmail.com'
);

-- Verify the update worked
SELECT p.id, p.role, p.created_at, p.last_seen_at
FROM profiles p
JOIN auth.users au ON au.id = p.id
WHERE au.email = 'vivianwachuu@gmail.com';
