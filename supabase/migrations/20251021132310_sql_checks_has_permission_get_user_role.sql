BEGIN;

-- SQL checks for has_permission and get_user_role to validate behavior per tenant
DO $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_role TEXT;
  v_perm BOOLEAN;
  v_resource TEXT;
  v_action TEXT;
BEGIN
  -- Pick an active user/tenant pair
  SELECT ut.user_id, ut.tenant_id INTO v_user_id, v_tenant_id
  FROM public.user_tenants ut
  WHERE ut.status = 'active'
  LIMIT 1;

  IF v_user_id IS NULL OR v_tenant_id IS NULL THEN
    RAISE NOTICE 'HAS_PERMISSION CHECK: Nenhum par ativo encontrado em user_tenants';
    RETURN;
  END IF;

  -- get_user_role
  BEGIN
    SELECT public.get_user_role(v_tenant_id, v_user_id) INTO v_role;
    RAISE NOTICE 'CHECK: get_user_role(tenant_id=%, user_id=%) -> %', v_tenant_id, v_user_id, v_role;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'CHECK ERR: get_user_role -> %', SQLERRM;
  END;

  -- has_permission tests (campaigns/read, contacts/update, settings/manage)
  FOR v_resource, v_action IN 
    SELECT 'campaigns', 'read' UNION ALL
    SELECT 'contacts', 'update' UNION ALL
    SELECT 'settings', 'manage'
  LOOP
    BEGIN
      SELECT public.has_permission(v_user_id, v_tenant_id, v_resource, v_action) INTO v_perm;
      RAISE NOTICE 'CHECK: has_permission(user_id=%, tenant_id=%, resource=%, action=%) -> %', v_user_id, v_tenant_id, v_resource, v_action, v_perm;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'CHECK ERR: has_permission(resource=%, action=%) -> %', v_resource, v_action, SQLERRM;
    END;
  END LOOP;
END$$;

COMMIT;