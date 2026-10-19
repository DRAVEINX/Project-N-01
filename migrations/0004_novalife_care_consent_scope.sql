-- Allow explicit consent-record authorization grants used by the care-consent-record policy.
-- This adds a granular scope; it does not grant access to any account or client.
ALTER TABLE novalife_consent_grants
  DROP CONSTRAINT IF EXISTS novalife_consent_grants_scope_check;

ALTER TABLE novalife_consent_grants
  ADD CONSTRAINT novalife_consent_grants_scope_check
  CHECK (scope IN (
    'mood', 'journal', 'care_plan', 'care_note', 'care_task', 'care_report',
    'care_document', 'medication_overview', 'care_message', 'roster', 'team',
    'care_consents'
  ));
