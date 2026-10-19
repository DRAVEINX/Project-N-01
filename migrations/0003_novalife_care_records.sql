-- Durable, tenant-scoped storage for NovaLife care-portal records.
-- Apply only after reviewing the deployment's backup, retention and access policies.
CREATE TABLE IF NOT EXISTS novalife_care_records (
  client_id TEXT NOT NULL REFERENCES novalife_accounts(id) ON DELETE RESTRICT,
  resource TEXT NOT NULL CHECK (resource IN (
    'care-plan', 'care-note', 'care-task', 'care-report',
    'care-document', 'medication-overview', 'care-message',
    'care-roster', 'care-team', 'care-consent-record'
  )),
  record_id TEXT NOT NULL,
  data JSONB NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  created_by TEXT NOT NULL REFERENCES novalife_accounts(id) ON DELETE RESTRICT,
  updated_by TEXT NOT NULL REFERENCES novalife_accounts(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, resource, record_id),
  CHECK (length(record_id) BETWEEN 1 AND 200)
);

CREATE INDEX IF NOT EXISTS novalife_care_records_client_resource_updated_idx
  ON novalife_care_records (client_id, resource, updated_at DESC, record_id);
