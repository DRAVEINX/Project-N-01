# PlanSamen Supabase security status

Last reviewed: 2026-10-23  
Supabase project: `gvqiktkfsyyjjkxoqiqd` (EU West / Ireland)  
This file documents the dedicated PlanSamen project. Do not apply its setup to NovaLife.

## Database protections currently verified

- The five `public.plansamen_*` tables have row-level security enabled and FORCE RLS enabled.
- Profiles are created after Supabase Auth signup by a trigger in the non-exposed `plansamen_private` schema. New profiles receive the fixed role `client`; user-editable Auth metadata cannot assign a privileged role.
- Authenticated users can read their own profile and update only their `display_name` column. Role changes are not granted through the client API.
- Relationship rows are readable only to the client and caregiver named in each row. Client API roles have no INSERT, UPDATE, or DELETE grants on relationships; activation/revocation must be performed by a trusted server workflow.
- Appointment access is restricted by RLS to the client and active linked caregivers. Appointment creation requires the authenticated actor to be the recorded creator and a permitted participant. No client DELETE grant/policy exists.
- Roster shifts are scoped to the caregiver account that owns them. No client DELETE grant/policy exists.
- Audit events have no client-facing policies and no client grants. This is intentional: do not expose raw audit trails to the mobile app.
- Triggers maintain `updated_at` on profiles, relationships, appointments, and roster shifts.
- PostgreSQL exclusion constraints prevent overlapping scheduled appointments for the same client, overlapping assignments for the same caregiver, and overlapping roster shifts for the same caregiver. Adjacent half-open intervals are allowed.

## Current limits — not yet release-ready

- The mobile app is **not yet connected** to Supabase; the prototype API still runs in no-auth/no-database/no-personal-data safety mode.
- No real user accounts or personal records were created for this work.
- A successful schema/policy metadata check is not a substitute for end-to-end tests with separate client and caregiver test accounts.
- Guardian/parent consent flows, trusted-server invitation/activation/revocation endpoints, session/auth integration, and API rate limiting still need implementation and tests before any personal data is accepted.
- The security advisor currently reports one informational finding: `plansamen_audit_events` has RLS enabled but no policies. This is intentional, not an authorization gap to fix by opening the table. Reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

## Release gate

Do not enable personal-data acceptance, publish a production endpoint, or add service-role credentials to the client. Before enabling data access, implement a trusted server-only workflow for relationship lifecycle and verify authorization, revocation, overlap conflicts, and denial cases with disposable test users. Keep service-role credentials exclusively on the server, in secret storage.
