-- Only one non-revoked consent row may exist for each client, recipient and scope.
-- Expired rows remain unique until updated/renewed; revocation frees the key so
-- the client can grant consent again without creating ambiguous duplicate grants.
CREATE UNIQUE INDEX IF NOT EXISTS novalife_consent_active_unique
  ON public.novalife_consent_grants (client_id, grantee_id, scope)
  WHERE revoked_at IS NULL;
