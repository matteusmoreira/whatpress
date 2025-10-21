BEGIN;

-- Fix ambiguous references in has_permission by using local variables
CREATE OR REPLACE FUNCTION public.has_permission(
  user_id UUID,
  tenant_id UUID,
  resource TEXT,
  action TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  p_user_id UUID := user_id;
  p_tenant_id UUID := tenant_id;
  p_resource TEXT := resource;
  p_action TEXT := action;
  user_role TEXT;
  has_perm BOOLEAN := false;
BEGIN
  -- Get user's role for tenant
  user_role := public.get_user_role(p_tenant_id, p_user_id);
  
  -- If no role, no permission
  IF user_role = 'NONE' THEN
    RETURN false;
  END IF;
  
  -- Check permission in role_permissions
  SELECT rp.allowed INTO has_perm
  FROM public.role_permissions rp
  WHERE rp.role = user_role
    AND rp.resource = p_resource
    AND rp.action = p_action;
  
  RETURN COALESCE(has_perm, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Post-fix quick checks
DO $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_perm BOOLEAN;
BEGIN
  SELECT ut.user_id, ut.tenant_id INTO v_user_id, v_tenant_id
  FROM public.user_tenants ut
  WHERE ut.status = 'active'
  LIMIT 1;

  IF v_user_id IS NULL OR v_tenant_id IS NULL THEN
    RAISE NOTICE 'POST-FIX has_permission: Nenhum par ativo encontrado para testar.';
    RETURN;
  END IF;

  FOR v_perm IN 
    SELECT public.has_permission(v_user_id, v_tenant_id, 'campaigns', 'read')
  LOOP
    RAISE NOTICE 'POST-FIX CHECK: has_permission(campaigns/read) -> %', v_perm;
  END LOOP;

  FOR v_perm IN 
    SELECT public.has_permission(v_user_id, v_tenant_id, 'contacts', 'update')
  LOOP
    RAISE NOTICE 'POST-FIX CHECK: has_permission(contacts/update) -> %', v_perm;
  END LOOP;

  FOR v_perm IN 
    SELECT public.has_permission(v_user_id, v_tenant_id, 'settings', 'manage')
  LOOP
    RAISE NOTICE 'POST-FIX CHECK: has_permission(settings/manage) -> %', v_perm;
  END LOOP;
END$$;

COMMIT;