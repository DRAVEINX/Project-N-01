-- Permit the private API role to create/revoke client-owned consent grants
-- without granting table-wide write access to the consent table.
GRANT INSERT (id, client_id, grantee_id, scope, granted_by, expires_at)
  ON TABLE public.novalife_consent_grants
  TO novalife_api;

GRANT UPDATE (granted_by, granted_at, expires_at, revoked_at)
  ON TABLE public.novalife_consent_grants
  TO novalife_api;
