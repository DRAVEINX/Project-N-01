-- Index foreign-key columns that are not already covered by a suitable
-- leading index. This keeps account/assignment/consent maintenance efficient
-- as the tables grow; existing data and access privileges are unchanged.
CREATE INDEX IF NOT EXISTS novalife_care_records_created_by_idx
  ON public.novalife_care_records (created_by);

CREATE INDEX IF NOT EXISTS novalife_care_records_updated_by_idx
  ON public.novalife_care_records (updated_by);

CREATE INDEX IF NOT EXISTS novalife_client_assignments_created_by_idx
  ON public.novalife_client_assignments (created_by);

CREATE INDEX IF NOT EXISTS novalife_consent_grants_granted_by_idx
  ON public.novalife_consent_grants (granted_by);

CREATE INDEX IF NOT EXISTS novalife_consent_grants_grantee_idx
  ON public.novalife_consent_grants (grantee_id);
