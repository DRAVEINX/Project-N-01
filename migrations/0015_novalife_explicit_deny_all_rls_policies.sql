-- Defense in depth for the exposed public schema. The Data API roles have
-- no direct table grants (see 0008), and this restrictive policy additionally
-- prevents row access if a permissive policy is accidentally added later.
-- The trusted, server-only novalife_api role BYPASSRLS and is guarded by its
-- narrow table grants plus server-side assignment/consent authorization.
DO $migration$
DECLARE
  target_table text;
  tables text[] := ARRAY[
    'novalife_accounts',
    'novalife_sessions',
    'novalife_client_assignments',
    'novalife_consent_grants',
    'novalife_audit_events',
    'novalife_care_records'
  ];
BEGIN
  FOREACH target_table IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1
        FROM pg_catalog.pg_policies
       WHERE schemaname = 'public'
         AND tablename = target_table
         AND policyname = 'novalife_restrict_direct_access'
    ) THEN
      EXECUTE format(
        'CREATE POLICY novalife_restrict_direct_access ON public.%I AS RESTRICTIVE FOR ALL TO PUBLIC USING (false) WITH CHECK (false)',
        target_table
      );
    END IF;
  END LOOP;
END
$migration$;
