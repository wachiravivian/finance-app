-- Test Script - Run this AFTER the debug_and_fix_database.sql script
-- This will test if the authentication is working properly

-- Test 1: Check if we can query the profile as the authenticated user
-- (This simulates what the useAuth hook is trying to do)
SELECT 
  'Profile Query Test' as test_name,
  p.id,
  p.role,
  p.created_at
FROM profiles p
WHERE p.id = (
  SELECT id FROM auth.users WHERE email = 'vivianwachuu@gmail.com'
);

-- Test 2: Check RLS policies are working correctly
SELECT 
  'RLS Policy Test' as test_name,
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

-- Test 3: Verify the user can update their own profile (for last_seen_at)
-- This simulates the update that happens in useAuth hook
UPDATE profiles 
SET last_seen_at = NOW()
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'vivianwachuu@gmail.com'
);

-- Test 4: Final verification
SELECT 
  'Final Check' as test_name,
  p.id,
  p.role,
  p.last_seen_at,
  'Profile exists and is accessible' as status
FROM profiles p
JOIN auth.users au ON au.id = p.id
WHERE au.email = 'vivianwachuu@gmail.com';
