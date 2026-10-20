-- NovaLife uses a private server-side PostgreSQL API, not direct browser
-- access to these tables through the Supabase Data API. Remove the project's
-- broad default table grants for these records and future public tables.
-- The trusted table owner/private API connection retains owner privileges.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE
  public.novalife_accounts,
  public.novalife_sessions,
  public.novalife_client_assignments,
  public.novalife_consent_grants,
  public.novalife_audit_events,
  public.novalife_care_records
FROM PUBLIC, anon, authenticated, service_role;
