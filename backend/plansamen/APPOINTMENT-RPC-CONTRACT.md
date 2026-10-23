# PlanSamen appointment write contract (design only)

Status: **not deployed and not connected to the HTTP server**. This contract defines the minimum safe shape for a future database-backed write. It must not be treated as an executable migration or a claim that online appointments work.

## Recommended operation boundary

Expose one narrowly scoped Postgres function or authenticated Edge Function for creating an appointment. The operation must perform authorization, relationship checks, conflict-safe insertion, and audit insertion as one transaction. Do not split these steps into independent PostgREST requests.

Inputs should be limited to:
- client UUID
- optional assigned caregiver UUID
- start and end timestamps with explicit timezone at the API boundary
- title (1–200 characters)
- pictogram (0–16 characters)
- notes (0–4000 characters)

Do not accept `created_by_user_id`, actor role, status, or trusted relationship state from the client. Derive the actor from the verified Supabase access token and the database's trusted profile record. The actor UUID and role supplied to the service must never come from request JSON.

## Required transaction behavior

1. Reject requests without a valid authenticated identity.
2. Load the actor role from trusted database state; fail closed if absent, duplicated, or invalid.
3. Lock and validate the active client-caregiver relationship inside the same transaction as the write. Relationship changes must use compatible locking so revocation cannot race an accepted write.
4. Permit clients to create appointments only for their own client UUID.
5. Permit caregivers only for clients with an active relationship. Do not allow a caregiver to assign a different caregiver unless that assignment is independently authorized by the product's explicit rules.
6. Insert only after all checks pass. Keep the existing GiST exclusion constraints as the final protection against concurrent overlaps.
7. Write a minimal audit event in the same transaction. Never write appointment notes or other free text into the audit record.
8. Return only the newly created appointment fields the caller is allowed to see. Never return SQL errors, stack traces, access tokens, or unrelated row contents.

## Privilege and RLS requirements

- Keep `service_role` and secret keys on trusted server infrastructure only; never package them in Android or browser builds.
- Prefer `SECURITY INVOKER` and caller-scoped grants/RLS where feasible.
- If a `SECURITY DEFINER` function is proven necessary, put it in a non-exposed schema, set a fixed safe `search_path`, explicitly validate `auth.uid()`, revoke default `EXECUTE` from `PUBLIC`, and grant execute only to the intended database role. Review the function owner and its RLS bypass privileges.
- Do not add broad `authenticated` grants as a substitute for row-level authorization.
- Do not enable appointment, roster, or relationship API routes until negative and concurrency tests pass.

## Acceptance tests before implementation can be enabled

- unauthenticated and expired-token requests are denied
- client A cannot read or write client B's appointments
- caregiver without an active relationship is denied
- revocation racing a create cannot result in a post-revocation unauthorized write
- two concurrent overlapping creates cannot both commit
- adjacent intervals (end equals next start) are allowed
- cancelled appointments do not block a new appointment
- invalid timestamps, invalid roles, oversized payloads, and unexpected fields are rejected
- responses and logs contain no notes, tokens, SQL, or private records on errors
- synthetic client/caregiver end-to-end tests pass against the deployed configuration

## Release gate

Keep `GET /api/v1/healthz` reporting the backend as unconfigured and keep all personal-data API routes disabled until the implementation and tests are reviewed. This design document does not change Supabase, production configuration, or `main`.
