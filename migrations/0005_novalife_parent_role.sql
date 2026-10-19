-- Add the parent role consistently to account and assignment constraints.
-- This migration is idempotent by constraint name and grants no assignments or consent.
ALTER TABLE novalife_accounts
  DROP CONSTRAINT IF EXISTS novalife_accounts_role_check;
ALTER TABLE novalife_accounts
  ADD CONSTRAINT novalife_accounts_role_check
  CHECK (role IN ('client', 'caregiver', 'parent', 'guardian', 'developer_admin'));

ALTER TABLE novalife_client_assignments
  DROP CONSTRAINT IF EXISTS novalife_client_assignments_assignment_role_check;
ALTER TABLE novalife_client_assignments
  ADD CONSTRAINT novalife_client_assignments_assignment_role_check
  CHECK (assignment_role IN ('caregiver', 'parent', 'guardian'));
