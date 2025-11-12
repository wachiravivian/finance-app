-- Fix admin role for vivianwachuu@gmail.com
-- Run this in Supabase SQL Editor

-- First, let's see what we have
SELECT 
  au.id as auth_id,
  au.email,
  p.id as profile_id,
  p.role,
  p.created_at
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
WHERE au.email = 'vivianwachuu@gmail.com';

-- If no profile exists, create one with admin role
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

-- If profile exists but role is not admin, update it
UPDATE profiles 
SET role = 'admin'
WHERE id = (
  SELECT au.id 
  FROM auth.users au 
  WHERE au.email = 'vivianwachuu@gmail.com'
)
AND role != 'admin';

-- Verify the result
SELECT 
  au.id as auth_id,
  au.email,
  p.id as profile_id,
  p.role,
  p.created_at
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
WHERE au.email = 'vivianwachuu@gmail.com';
