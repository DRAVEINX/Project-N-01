-- The API supports client-owned mood reports. Keep the database resource constraint
-- aligned with the API allow-list so these personal reports can be persisted.
ALTER TABLE novalife_care_records
  DROP CONSTRAINT IF EXISTS novalife_care_records_resource_check;

ALTER TABLE novalife_care_records
  ADD CONSTRAINT novalife_care_records_resource_check
  CHECK (resource IN (
    'mood-report',
    'care-plan', 'care-note', 'care-task', 'care-report',
    'care-document', 'medication-overview', 'care-message',
    'care-roster', 'care-team', 'care-consent-record'
  ));
