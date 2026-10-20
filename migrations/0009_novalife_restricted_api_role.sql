-- Dedicated server-only database role for NovaLife's Node API.
-- No password is set in source control or by this migration. Set a strong
-- password through the Supabase role-management UI before configuring a host.
-- BYPASSRLS is limited to this non-superuser role because the API enforces
-- assignments/consent in trusted server code and the tables have no public
-- Data API grants or policies. Grant only the tables the API needs.
DO $migration$
DECLARE
  existing_superuser boolean;
  existing_bypass boolean;
  existing_createdb boolean;
  existing_createrole boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'novalife_api'
  ) THEN
    CREATE ROLE novalife_api
      LOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      BYPASSRLS;
  ELSE
    SELECT rolsuper, rolbypassrls, rolcreatedb, rolcreaterole
      INTO existing_superuser, existing_bypass, existing_createdb, existing_createrole
      FROM pg_catalog.pg_roles
     WHERE rolname = 'novalife_api';

    IF existing_superuser OR NOT existing_bypass OR existing_createdb OR existing_createrole THEN
      RAISE EXCEPTION 'Existing novalife_api role has unexpected privileged attributes; review it manually';
    END IF;
  END IF;
END
$migration$;

GRANT USAGE ON SCHEMA public TO novalife_api;

GRANT SELECT ON TABLE public.novalife_accounts
  TO novalife_api;
GRANT SELECT, INSERT, DELETE ON TABLE public.novalife_sessions
  TO novalife_api;
GRANT SELECT ON TABLE public.novalife_client_assignments
  TO novalife_api;
GRANT SELECT ON TABLE public.novalife_consent_grants
  TO novalife_api;
GRANT INSERT ON TABLE public.novalife_audit_events
  TO novalife_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.novalife_care_records
  TO novalife_api;
