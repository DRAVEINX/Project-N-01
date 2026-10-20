-- NovaLife uses a private server-side PostgreSQL API, not direct browser
-- access to these tables through the Supabase Data API. Remove broad default
-- grants for public API roles on future objects created by the migration role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

-- Also remove any existing grants when this migration is applied after the
-- initial schema, while allowing this lock-down to run safely before it too.
DO $migration$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'novalife_accounts',
    'novalife_sessions',
    'novalife_client_assignments',
    'novalife_consent_grants',
    'novalife_audit_events',
    'novalife_care_records'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated, service_role',
        table_name
      );
    END IF;
  END LOOP;
END
$migration$;
