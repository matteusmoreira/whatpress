BEGIN;

-- Ensure old function signature is removed to avoid ambiguity
DROP FUNCTION IF EXISTS public.get_user_role(UUID, UUID);

-- Updated get_user_role with parameter name p_user_id to avoid ambiguity
CREATE OR REPLACE FUNCTION public.get_user_role(tenant_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT ut.role INTO user_role
  FROM public.user_tenants ut 
  WHERE ut.user_id = COALESCE(p_user_id, auth.uid()) 
  AND ut.tenant_id = tenant_id
  AND ut.status = 'active';
  
  RETURN COALESCE(user_role, 'NONE');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updated get_user_tenants to use p_user_id, filtering only active associations
DROP FUNCTION IF EXISTS public.get_user_tenants(UUID);
CREATE OR REPLACE FUNCTION public.get_user_tenants(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE (
  tenant_id UUID,
  tenant_name TEXT,
  tenant_plan TEXT,
  tenant_status TEXT,
  user_role TEXT,
  user_status TEXT,
  joined_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id as tenant_id,
    t.name as tenant_name,
    t.plan as tenant_plan,
    t.status as tenant_status,
    ut.role as user_role,
    ut.status as user_status,
    ut.created_at as joined_at
  FROM public.user_tenants ut
  JOIN public.tenants t ON t.id = ut.tenant_id
  WHERE ut.user_id = COALESCE(p_user_id, auth.uid())
  AND ut.status = 'active'
  ORDER BY ut.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;