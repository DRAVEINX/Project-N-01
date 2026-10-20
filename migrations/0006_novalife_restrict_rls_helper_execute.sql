-- Keep the automatic RLS event trigger, but do not expose its SECURITY DEFINER
-- helper as an RPC callable by public API roles.
-- This migration is safe on environments where the optional helper is absent.
DO $migration$
DECLARE
  role_name text;
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC';

    FOR role_name IN
      SELECT rolname
      FROM pg_catalog.pg_roles
      WHERE rolname IN ('anon', 'authenticated', 'service_role')
    LOOP
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM %I',
        role_name
      );
    END LOOP;
  END IF;
END
$migration$;
