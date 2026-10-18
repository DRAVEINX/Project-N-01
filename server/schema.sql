CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS n01_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  mfa_secret_encrypted TEXT,
  mfa_pending_secret_encrypted TEXT,
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS n01_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES n01_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS n01_sessions_user_active ON n01_sessions(user_id, expires_at) WHERE revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS n01_password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES n01_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS n01_reset_user ON n01_password_resets(user_id, expires_at);
CREATE TABLE IF NOT EXISTS n01_vaults (
  user_id UUID PRIMARY KEY REFERENCES n01_users(id) ON DELETE CASCADE,
  version BIGINT NOT NULL DEFAULT 0,
  envelope JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS n01_vault_revisions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES n01_users(id) ON DELETE CASCADE,
  version BIGINT NOT NULL,
  envelope JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, version)
);
CREATE INDEX IF NOT EXISTS n01_vault_revisions_recent ON n01_vault_revisions(user_id, version DESC);
CREATE TABLE IF NOT EXISTS n01_households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES n01_users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS n01_household_members (
  household_id UUID NOT NULL REFERENCES n01_households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES n01_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','user','parent','guardian','caregiver')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (household_id,user_id)
);
CREATE TABLE IF NOT EXISTS n01_household_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES n01_households(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','parent','guardian','caregiver')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_by UUID REFERENCES n01_users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES n01_users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS n01_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES n01_households(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES n01_users(id) ON DELETE CASCADE,
  viewer_user_id UUID NOT NULL REFERENCES n01_users(id) ON DELETE CASCADE,
  scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  edit_scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  CHECK (owner_user_id <> viewer_user_id)
);
CREATE INDEX IF NOT EXISTS n01_consents_active ON n01_consents(household_id, owner_user_id) WHERE revoked_at IS NULL;
