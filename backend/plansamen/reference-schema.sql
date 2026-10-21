-- PlanSamen reference schema (NOT a deployed migration).
-- Target: PostgreSQL. Review and adapt auth foreign keys and RLS policies only
-- after a dedicated PlanSamen backend has been approved and provisioned.
-- This file intentionally enables RLS without adding permissive policies:
-- until trusted identity/relationship policies exist, API access is denied.
-- Never apply this to NovaLife or another existing project.

BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS plansamen_profiles (
  user_id uuid PRIMARY KEY,
  display_name text NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 120),
  role text NOT NULL CHECK (role IN ('client', 'caregiver', 'guardian', 'parent', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plansamen_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid NOT NULL REFERENCES plansamen_profiles(user_id) ON DELETE RESTRICT,
  caregiver_user_id uuid NOT NULL REFERENCES plansamen_profiles(user_id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  revoked_at timestamptz,
  CHECK (client_user_id <> caregiver_user_id),
  UNIQUE (client_user_id, caregiver_user_id)
);

CREATE TABLE IF NOT EXISTS plansamen_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid NOT NULL REFERENCES plansamen_profiles(user_id) ON DELETE RESTRICT,
  created_by_user_id uuid NOT NULL REFERENCES plansamen_profiles(user_id) ON DELETE RESTRICT,
  assigned_caregiver_user_id uuid REFERENCES plansamen_profiles(user_id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'Europe/Amsterdam',
  pictogram text NOT NULL DEFAULT '📅' CHECK (length(pictogram) <= 16),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 4000),
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  -- Half-open intervals: 10:00-10:30 and 10:30-11:00 are allowed.
  -- This constraint is the final race-safe guard for a client's calendar.
  CONSTRAINT plansamen_client_appointments_no_overlap
    EXCLUDE USING gist (
      client_user_id WITH =,
      tstzrange(starts_at, ends_at, '[)') WITH &&
    ) WHERE (status = 'scheduled'),
  -- A caregiver must not be assigned to two clients at overlapping times.
  -- NULL assignments are excluded by PostgreSQL equality semantics.
  CONSTRAINT plansamen_caregiver_appointments_no_overlap
    EXCLUDE USING gist (
      assigned_caregiver_user_id WITH =,
      tstzrange(starts_at, ends_at, '[)') WITH &&
    ) WHERE (status = 'scheduled' AND assigned_caregiver_user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS plansamen_appointments_client_start_idx
  ON plansamen_appointments (client_user_id, starts_at)
  WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS plansamen_appointments_assigned_caregiver_start_idx
  ON plansamen_appointments (assigned_caregiver_user_id, starts_at)
  WHERE status = 'scheduled' AND assigned_caregiver_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS plansamen_relationships_active_idx
  ON plansamen_relationships (caregiver_user_id, client_user_id)
  WHERE status = 'active';

-- Caregiver roster shifts. This is a reference schema only, not deployed.
-- The database prevents concurrent/overlapping shifts for the same caregiver.
CREATE TABLE IF NOT EXISTS plansamen_roster_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_user_id uuid NOT NULL REFERENCES plansamen_profiles(user_id) ON DELETE RESTRICT,
  created_by_user_id uuid NOT NULL REFERENCES plansamen_profiles(user_id) ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'cancelled')),
  label text NOT NULL DEFAULT '' CHECK (length(label) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CONSTRAINT plansamen_caregiver_shifts_no_overlap
    EXCLUDE USING gist (
      caregiver_user_id WITH =,
      tstzrange(starts_at, ends_at, '[)') WITH &&
    ) WHERE (status = 'scheduled')
);

CREATE INDEX IF NOT EXISTS plansamen_roster_shifts_caregiver_start_idx
  ON plansamen_roster_shifts (caregiver_user_id, starts_at)
  WHERE status = 'scheduled';


CREATE TABLE IF NOT EXISTS plansamen_audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid REFERENCES plansamen_profiles(user_id) ON DELETE SET NULL,
  action text NOT NULL CHECK (length(trim(action)) BETWEEN 1 AND 100),
  subject_type text NOT NULL CHECK (length(trim(subject_type)) BETWEEN 1 AND 100),
  subject_id text,
  occurred_at timestamptz NOT NULL DEFAULT now()
  -- Do not put appointment notes, medical details, or other free text here.
);

ALTER TABLE plansamen_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE plansamen_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE plansamen_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE plansamen_relationships FORCE ROW LEVEL SECURITY;
ALTER TABLE plansamen_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE plansamen_appointments FORCE ROW LEVEL SECURITY;
ALTER TABLE plansamen_roster_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE plansamen_roster_shifts FORCE ROW LEVEL SECURITY;
ALTER TABLE plansamen_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE plansamen_audit_events FORCE ROW LEVEL SECURITY;

-- Intentionally no client-facing policies yet. RLS denies access by default.
-- Before use, add and test policies tied to the selected trusted auth provider,
-- active caregiver/client relationships, and server-validated role assignment.
-- Never expose a service-role/database-owner credential to the mobile client.

COMMIT;
