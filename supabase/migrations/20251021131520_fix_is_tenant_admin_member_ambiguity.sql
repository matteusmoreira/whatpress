BEGIN;

-- Fix ambiguous column reference "tenant_id" by fully qualifying columns with table aliases
-- and standardizing use of a local p_user_id variable in helper functions.

-- Tenant ADMIN check (fix)
CREATE OR REPLACE FUNCTION public.is_tenant_admin(tenant_id UUID, user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
DECLARE
  p_user_id UUID := COALESCE(user_id, auth.uid());
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_tenants AS ut
    WHERE ut.user_id = p_user_id
      AND ut.tenant_id = tenant_id
      AND ut.role IN ('SUPERADMIN', 'ADMIN')
      AND ut.status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tenant MEMBER check (fix)
CREATE OR REPLACE FUNCTION public.is_tenant_member(tenant_id UUID, user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
DECLARE
  p_user_id UUID := COALESCE(user_id, auth.uid());
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_tenants AS ut
    WHERE ut.user_id = p_user_id
      AND ut.tenant_id = tenant_id
      AND ut.status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional re-check block to emit a NOTICE that functions execute without ambiguity
DO $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_is_admin BOOLEAN;
  v_is_member BOOLEAN;
BEGIN
  SELECT ut.user_id, ut.tenant_id INTO v_user_id, v_tenant_id
  FROM public.user_tenants ut
  WHERE ut.status = 'active'
  LIMIT 1;

  IF v_user_id IS NOT NULL AND v_tenant_id IS NOT NULL THEN
    BEGIN
      SELECT public.is_tenant_admin(v_tenant_id, v_user_id) INTO v_is_admin;
      RAISE NOTICE 'POST-FIX CHECK: is_tenant_admin(tenant_id=%, user_id=%) -> %', v_tenant_id, v_user_id, v_is_admin;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'POST-FIX CHECK ERR: is_tenant_admin -> %', SQLERRM;
    END;

    BEGIN
      SELECT public.is_tenant_member(v_tenant_id, v_user_id) INTO v_is_member;
      RAISE NOTICE 'POST-FIX CHECK: is_tenant_member(tenant_id=%, user_id=%) -> %', v_tenant_id, v_user_id, v_is_member;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'POST-FIX CHECK ERR: is_tenant_member -> %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'POST-FIX CHECK: Nenhum registro ativo em user_tenants para testar.';
  END IF;
END$$;

COMMIT;