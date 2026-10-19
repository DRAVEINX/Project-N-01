-- Add the parent role to existing NovaLife PostgreSQL installations.
-- Safe to run after 0001 on both fresh and already-created schemas.
-- Review and apply through the project's controlled migration process.

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
