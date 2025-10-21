BEGIN;

-- Migração de check detalhado por função
-- Não altera dados. Usa DO e RAISE NOTICE/ERROR capturado para apontar a função que falha.

DO $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_role TEXT;
  v_user_role TEXT;
  v_count INTEGER;
  v_resource TEXT;
  v_action TEXT;
  v_perm BOOLEAN;
  v_is_superadmin BOOLEAN;
  v_is_admin BOOLEAN;
  v_is_member BOOLEAN;
  v_role_permissions_exist BOOLEAN;
BEGIN
  -- Seleciona um vínculo ativo user-tenant
  SELECT ut.user_id, ut.tenant_id, ut.role
  INTO v_user_id, v_tenant_id, v_role
  FROM public.user_tenants ut
  WHERE ut.status = 'active'
  LIMIT 1;

  IF v_user_id IS NULL OR v_tenant_id IS NULL THEN
    RAISE NOTICE 'DETAILED CHECK: Nenhum registro ativo em user_tenants encontrado. Pulando checks.';
    RETURN;
  END IF;

  -- get_user_role
  BEGIN
    SELECT public.get_user_role(v_tenant_id, v_user_id) INTO v_user_role;
    RAISE NOTICE 'DETAILED CHECK OK: get_user_role(tenant_id=%) -> %', v_tenant_id, v_user_role;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'DETAILED CHECK ERR: get_user_role -> %', SQLERRM;
  END;

  -- get_user_tenants (contagem)
  BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.get_user_tenants(v_user_id);
    RAISE NOTICE 'DETAILED CHECK OK: get_user_tenants(p_user_id=%) -> % tenants', v_user_id, v_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'DETAILED CHECK ERR: get_user_tenants -> %', SQLERRM;
  END;

  -- has_permission (usa um recurso/ação permitido para a role atual)
  BEGIN
    SELECT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'role_permissions'
    ) INTO v_role_permissions_exist;

    IF v_role_permissions_exist THEN
      SELECT rp.resource, rp.action INTO v_resource, v_action
      FROM public.role_permissions rp
      WHERE rp.role = v_role AND rp.allowed = true
      LIMIT 1;

      IF v_resource IS NULL OR v_action IS NULL THEN
        RAISE NOTICE 'DETAILED CHECK INFO: Nenhuma permissão allowed para role % encontrada.', v_role;
      ELSE
        SELECT public.has_permission(v_user_id, v_tenant_id, v_resource, v_action)
          INTO v_perm;
        RAISE NOTICE 'DETAILED CHECK OK: has_permission(user_id=%, tenant_id=%, resource=%, action=%) -> %', v_user_id, v_tenant_id, v_resource, v_action, v_perm;
      END IF;
    ELSE
      RAISE NOTICE 'DETAILED CHECK INFO: Tabela role_permissions não encontrada. Pulando teste de has_permission.';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'DETAILED CHECK ERR: has_permission -> %', SQLERRM;
  END;

  -- is_superadmin
  BEGIN
    SELECT public.is_superadmin(v_user_id) INTO v_is_superadmin;
    RAISE NOTICE 'DETAILED CHECK OK: is_superadmin(user_id=%) -> %', v_user_id, v_is_superadmin;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'DETAILED CHECK ERR: is_superadmin -> %', SQLERRM;
  END;

  -- is_tenant_admin
  BEGIN
    SELECT public.is_tenant_admin(v_tenant_id, v_user_id) INTO v_is_admin;
    RAISE NOTICE 'DETAILED CHECK OK: is_tenant_admin(tenant_id=%, user_id=%) -> %', v_tenant_id, v_user_id, v_is_admin;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'DETAILED CHECK ERR: is_tenant_admin -> %', SQLERRM;
  END;

  -- is_tenant_member
  BEGIN
    SELECT public.is_tenant_member(v_tenant_id, v_user_id) INTO v_is_member;
    RAISE NOTICE 'DETAILED CHECK OK: is_tenant_member(tenant_id=%, user_id=%) -> %', v_tenant_id, v_user_id, v_is_member;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'DETAILED CHECK ERR: is_tenant_member -> %', SQLERRM;
  END;

END $$ LANGUAGE plpgsql;

COMMIT;