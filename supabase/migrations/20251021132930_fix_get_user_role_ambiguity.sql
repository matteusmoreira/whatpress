BEGIN;

-- Fix ambiguous column reference in get_user_role by using local p_tenant_id
CREATE OR REPLACE FUNCTION public.get_user_role(tenant_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
  p_tenant_id UUID := tenant_id;
  p_uid UUID := COALESCE(p_user_id, auth.uid());
BEGIN
  SELECT ut.role INTO user_role
  FROM public.user_tenants ut 
  WHERE ut.user_id = p_uid
    AND ut.tenant_id = p_tenant_id
    AND ut.status = 'active';
  
  RETURN COALESCE(user_role, 'NONE');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Post-fix quick checks to ensure no ambiguity and has_permission works
DO $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_role TEXT;
  v_perm BOOLEAN;
BEGIN
  SELECT ut.user_id, ut.tenant_id INTO v_user_id, v_tenant_id
  FROM public.user_tenants ut
  WHERE ut.status = 'active'
  LIMIT 1;

  IF v_user_id IS NULL OR v_tenant_id IS NULL THEN
    RAISE NOTICE 'POST-FIX get_user_role: Nenhum par ativo encontrado para testar.';
    RETURN;
  END IF;

  BEGIN
    SELECT public.get_user_role(v_tenant_id, v_user_id) INTO v_role;
    RAISE NOTICE 'POST-FIX CHECK: get_user_role(tenant_id=%, user_id=%) -> %', v_tenant_id, v_user_id, v_role;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'POST-FIX CHECK ERR: get_user_role -> %', SQLERRM;
  END;

  -- Validate has_permission now that get_user_role is fixed
  BEGIN
    SELECT public.has_permission(v_user_id, v_tenant_id, 'campaigns', 'read') INTO v_perm;
    RAISE NOTICE 'POST-FIX CHECK: has_permission(campaigns/read) -> %', v_perm;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'POST-FIX CHECK ERR: has_permission(campaigns/read) -> %', SQLERRM;
  END;
END$$;

COMMIT;