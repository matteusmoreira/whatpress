BEGIN;

-- Standardize helper functions by using a local p_user_id variable to avoid ambiguous references,
-- while preserving the original parameter names to avoid breaking dependent policies.

-- SUPERADMIN check
CREATE OR REPLACE FUNCTION public.is_superadmin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
DECLARE
  p_user_id UUID := COALESCE(user_id, auth.uid());
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_tenants ut 
    WHERE ut.user_id = p_user_id
    AND ut.role = 'SUPERADMIN'
    AND ut.status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tenant ADMIN check
CREATE OR REPLACE FUNCTION public.is_tenant_admin(tenant_id UUID, user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
DECLARE
  p_user_id UUID := COALESCE(user_id, auth.uid());
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_tenants ut 
    WHERE ut.user_id = p_user_id
    AND ut.tenant_id = tenant_id
    AND ut.role IN ('SUPERADMIN', 'ADMIN')
    AND ut.status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tenant MEMBER check
CREATE OR REPLACE FUNCTION public.is_tenant_member(tenant_id UUID, user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
DECLARE
  p_user_id UUID := COALESCE(user_id, auth.uid());
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_tenants ut 
    WHERE ut.user_id = p_user_id
    AND ut.tenant_id = tenant_id
    AND ut.status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;