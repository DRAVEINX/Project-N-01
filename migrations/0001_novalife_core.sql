-- NovaLife PostgreSQL foundation (initial schema).
-- Apply only to a dedicated, access-controlled database after review.
-- Application IDs are opaque strings (UUIDs recommended); never use emails as IDs.

CREATE TABLE IF NOT EXISTS novalife_accounts (
  id TEXT PRIMARY KEY,
  email_normalized TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('client', 'caregiver', 'parent', 'guardian', 'developer_admin')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (length(id) BETWEEN 1 AND 200),
  CHECK (email_normalized = lower(trim(email_normalized))),
  CHECK (length(password_hash) >= 20)
);

CREATE TABLE IF NOT EXISTS novalife_sessions (
  token_digest CHAR(64) PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES novalife_accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  CHECK (expires_at > created_at),
  CHECK (token_digest ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS novalife_sessions_actor_idx
  ON novalife_sessions (actor_id);
CREATE INDEX IF NOT EXISTS novalife_sessions_expiry_idx
  ON novalife_sessions (expires_at);

CREATE TABLE IF NOT EXISTS novalife_client_assignments (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES novalife_accounts(id) ON DELETE RESTRICT,
  client_id TEXT NOT NULL REFERENCES novalife_accounts(id) ON DELETE RESTRICT,
  assignment_role TEXT NOT NULL CHECK (assignment_role IN ('caregiver', 'parent', 'guardian')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  created_by TEXT NOT NULL REFERENCES novalife_accounts(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (actor_id <> client_id),
  CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE INDEX IF NOT EXISTS novalife_assignments_actor_client_idx
  ON novalife_client_assignments (actor_id, client_id, active);
CREATE INDEX IF NOT EXISTS novalife_assignments_client_idx
  ON novalife_client_assignments (client_id, active);

CREATE TABLE IF NOT EXISTS novalife_consent_grants (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES novalife_accounts(id) ON DELETE RESTRICT,
  grantee_id TEXT NOT NULL REFERENCES novalife_accounts(id) ON DELETE RESTRICT,
  scope TEXT NOT NULL CHECK (scope IN (
    'mood', 'journal', 'care_plan', 'care_note', 'care_task', 'care_report',
    'care_document', 'medication_overview', 'care_message', 'roster', 'team'
  )),
  granted_by TEXT NOT NULL REFERENCES novalife_accounts(id) ON DELETE RESTRICT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  CHECK (client_id <> grantee_id),
  CHECK (expires_at IS NULL OR expires_at > granted_at),
  CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);

CREATE INDEX IF NOT EXISTS novalife_consent_lookup_idx
  ON novalife_consent_grants (client_id, grantee_id, scope, revoked_at);

CREATE TABLE IF NOT EXISTS novalife_audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  client_id TEXT,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('allow', 'deny', 'error')),
  reason TEXT NOT NULL,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS novalife_audit_actor_time_idx
  ON novalife_audit_events (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS novalife_audit_client_time_idx
  ON novalife_audit_events (client_id, created_at DESC);
