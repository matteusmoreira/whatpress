-- Fix SuperAdmin policies to allow proper access to tenants table
-- This migration fixes the RLS policies to allow SUPERADMIN users to see all tenants

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Read own tenants" ON public.tenants;
DROP POLICY IF EXISTS "Manage tenants (SUPERADMIN)" ON public.tenants;

-- Create new policies that work properly
CREATE POLICY "SuperAdmin can see all tenants" ON public.tenants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_tenants ut 
      WHERE ut.user_id = auth.uid() 
      AND ut.role = 'SUPERADMIN'
      AND ut.status = 'active'
    )
  );

CREATE POLICY "Users can see their own tenants" ON public.tenants FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT tenant_id FROM public.user_tenants 
      WHERE user_id = auth.uid() 
      AND status = 'active'
    )
  );

CREATE POLICY "SuperAdmin can manage all tenants" ON public.tenants FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_tenants ut 
      WHERE ut.user_id = auth.uid() 
      AND ut.role = 'SUPERADMIN'
      AND ut.status = 'active'
    )
  );

-- Also fix user_tenants policies
DROP POLICY IF EXISTS "Manage own user_tenants" ON public.user_tenants;

CREATE POLICY "Users can see their own associations" ON public.user_tenants FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "SuperAdmin can see all associations" ON public.user_tenants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_tenants ut 
      WHERE ut.user_id = auth.uid() 
      AND ut.role = 'SUPERADMIN'
      AND ut.status = 'active'
    )
  );

CREATE POLICY "SuperAdmin can manage associations" ON public.user_tenants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_tenants ut 
      WHERE ut.user_id = auth.uid() 
      AND ut.role = 'SUPERADMIN'
      AND ut.status = 'active'
    )
  );

-- Create a function to check if user is superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_tenants 
    WHERE user_id = user_uuid 
    AND role = 'SUPERADMIN' 
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;