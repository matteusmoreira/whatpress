BEGIN;

-- Debug: dump current function definitions for has_permission and get_user_role
DO $$
DECLARE
  def_has_perm TEXT;
  def_get_role TEXT;
BEGIN
  BEGIN
    SELECT pg_get_functiondef('public.has_permission(uuid, uuid, text, text)'::regprocedure) INTO def_has_perm;
    RAISE NOTICE 'DEBUG DEF has_permission(uuid, uuid, text, text): %', def_has_perm;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'DEBUG DEF ERR: has_permission -> %', SQLERRM;
  END;

  BEGIN
    SELECT pg_get_functiondef('public.get_user_role(uuid, uuid)'::regprocedure) INTO def_get_role;
    RAISE NOTICE 'DEBUG DEF get_user_role(uuid, uuid): %', def_get_role;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'DEBUG DEF ERR: get_user_role -> %', SQLERRM;
  END;
END$$;

COMMIT;