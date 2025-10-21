BEGIN;

-- Debug: dump current function definitions to NOTICEs to confirm which implementation is active on remote
DO $$
DECLARE
  def_admin TEXT;
  def_member TEXT;
BEGIN
  BEGIN
    SELECT pg_get_functiondef('public.is_tenant_admin(uuid, uuid)'::regprocedure) INTO def_admin;
    RAISE NOTICE 'DEBUG DEF is_tenant_admin(uuid, uuid): %', def_admin;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'DEBUG DEF ERR: is_tenant_admin(uuid, uuid) -> %', SQLERRM;
  END;

  BEGIN
    SELECT pg_get_functiondef('public.is_tenant_member(uuid, uuid)'::regprocedure) INTO def_member;
    RAISE NOTICE 'DEBUG DEF is_tenant_member(uuid, uuid): %', def_member;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'DEBUG DEF ERR: is_tenant_member(uuid, uuid) -> %', SQLERRM;
  END;
END$$;

COMMIT;