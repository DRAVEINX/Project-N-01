-- A care actor may have at most one active assignment row per client and role.
-- When an assignment ends, mark the old row inactive; a later relationship can
-- then be represented by a new row without losing the historical record.
CREATE UNIQUE INDEX IF NOT EXISTS novalife_active_assignment_unique
  ON public.novalife_client_assignments (actor_id, client_id, assignment_role)
  WHERE active = TRUE;
