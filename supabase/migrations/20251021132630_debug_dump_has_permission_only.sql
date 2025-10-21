BEGIN;

DO $$
DECLARE
  def_has_perm TEXT;
BEGIN
  BEGIN
    SELECT pg_get_functiondef('public.has_permission(uuid, uuid, text, text)'::regprocedure) INTO def_has_perm;
    RAISE NOTICE 'DEBUG DEF has_permission(uuid, uuid, text, text): %', def_has_perm;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'DEBUG DEF ERR: has_permission -> %', SQLERRM;
  END;
END$$;

COMMIT;