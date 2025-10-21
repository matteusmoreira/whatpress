BEGIN;

-- Migração de verificação simples das funções de roles e RPCs
-- Esta migração não altera dados. Ela executa checks e emite RAISE NOTICE
-- com resultados para facilitar a auditoria de comportamento após mudanças.

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
  v_has_superadmin BOOLEAN;
  v_is_admin BOOLEAN;
  v_is_member BOOLEAN;
  v_is_admin_member BOOLEAN;
  v_role_permissions_exist BOOLEAN;
BEGIN
  -- Seleciona um vínculo ativo user-tenant para usar nos checks
  SELECT ut.user_id, ut.tenant_id, ut.role
  INTO v_user_id, v_tenant_id, v_role
  FROM public.user_tenants ut
  WHERE ut.status = 'active'
  LIMIT 1;

  IF v_user_id IS NULL OR v_tenant_id IS NULL THEN
    RAISE NOTICE 'SQL CHECK: Nenhum registro ativo em user_tenants encontrado. Pulando checks.';
    RETURN;
  END IF;

  -- get_user_role (positional args para compatibilidade)
  SELECT public.get_user_role(v_tenant_id, v_user_id)
    INTO v_user_role;
  RAISE NOTICE 'SQL CHECK: get_user_role(tenant_id=%) -> %', v_tenant_id, v_user_role;

  -- get_user_tenants (contagem; positional args)
  SELECT COUNT(*) INTO v_count
  FROM public.get_user_tenants(v_user_id);
  RAISE NOTICE 'SQL CHECK: get_user_tenants(p_user_id=%) -> % tenants', v_user_id, v_count;

  -- has_permission (usa um recurso/ação permitido para a role atual)
  -- verifica se role_permissions existe
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
      RAISE NOTICE 'SQL CHECK: Nenhuma permissão allowed para role % encontrada.', v_role;
    ELSE
      SELECT public.has_permission(v_user_id, v_tenant_id, v_resource, v_action)
        INTO v_perm;
      RAISE NOTICE 'SQL CHECK: has_permission(user_id=%, tenant_id=%, resource=%, action=%) -> %', v_user_id, v_tenant_id, v_resource, v_action, v_perm;
    END IF;
  ELSE
    RAISE NOTICE 'SQL CHECK: Tabela role_permissions não encontrada. Pulando teste de has_permission.';
  END IF;

  -- is_superadmin (positional)
  SELECT public.is_superadmin(v_user_id) INTO v_is_superadmin;
  RAISE NOTICE 'SQL CHECK: is_superadmin(user_id=%) -> %', v_user_id, v_is_superadmin;

  SELECT EXISTS(
    SELECT 1 FROM public.user_tenants
    WHERE user_id = v_user_id AND role = 'SUPERADMIN' AND status = 'active'
  ) INTO v_has_superadmin;

  IF v_is_superadmin <> v_has_superadmin THEN
    RAISE NOTICE 'SQL CHECK WARN: is_superadmin mismatch: function=% vs membership=%', v_is_superadmin, v_has_superadmin;
  END IF;

  -- is_tenant_admin e is_tenant_member (positional)
  SELECT public.is_tenant_admin(v_tenant_id, v_user_id) INTO v_is_admin;
  RAISE NOTICE 'SQL CHECK: is_tenant_admin(tenant_id=%, user_id=%) -> %', v_tenant_id, v_user_id, v_is_admin;

  SELECT public.is_tenant_member(v_tenant_id, v_user_id) INTO v_is_member;
  RAISE NOTICE 'SQL CHECK: is_tenant_member(tenant_id=%, user_id=%) -> %', v_tenant_id, v_user_id, v_is_member;

  SELECT EXISTS(
    SELECT 1 FROM public.user_tenants
    WHERE user_id = v_user_id AND tenant_id = v_tenant_id AND status = 'active' AND role IN ('ADMIN', 'SUPERADMIN')
  ) INTO v_is_admin_member;

  IF v_is_admin <> v_is_admin_member THEN
    RAISE NOTICE 'SQL CHECK WARN: is_tenant_admin mismatch: function=% vs membership=%', v_is_admin, v_is_admin_member;
  END IF;

EXCEPTION WHEN OTHERS THEN
  -- Não falhar a migração: apenas reportar o erro
  RAISE NOTICE 'SQL CHECK ERROR: %', SQLERRM;
END $$ LANGUAGE plpgsql;

COMMIT;