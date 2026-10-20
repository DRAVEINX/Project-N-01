-- Restrict future sequences created in public by the migration owner.
-- NovaLife currently uses opaque text IDs rather than sequences; keep future
-- sequence objects private from Supabase API roles as well.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;
