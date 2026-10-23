# PlanSamen API enablement checklist

The HTTP API intentionally remains a prototype until every gate below is met. A green unit-test workflow is not evidence that production authentication or persistence is enabled.

## Current safe mode

- `GET /api/v1/healthz` reports `backendConfigured: false` and `acceptsPersonalData: false`.
- Other `/api/*` routes return `503 BACKEND_NOT_CONFIGURED`.
- Supabase identity verification and RLS-scoped role loading exist as isolated adapters; the HTTP server does not call them yet.
- Appointment application logic requires a transaction-capable repository and is not wired to the server.
- No production user records or personal data are required for the adapter tests.

## Required before enabling personal-data routes

1. **Use a transaction-capable server-side operation.** Do not emulate multi-statement transactions with separate PostgREST calls. Prefer a narrowly scoped PostgreSQL RPC or Supabase Edge Function that validates the caller and performs relationship checks, conflict checks, and the write atomically. Keep overlap exclusion constraints as the final concurrency guard.
2. **Minimize privileges.** Never ship a service-role/secret key to Android, web, or other clients. Any elevated server credential must stay server-side, be scoped to the minimum required operations, and must not bypass authorization logic.
3. **Resolve identity and role on every request.** Verify the access token through Supabase Auth, load the role from trusted database state using an RLS-scoped query, and fail closed on missing, duplicate, invalid, or unavailable role records. Never authorize from user-editable metadata.
4. **Check relationships inside the write transaction.** Caregiver access must be tied to an active client-caregiver relationship; relationship revocation must not race a write.
5. **Validate and bound input.** Enforce request-size limits, strict JSON content type, allowed methods, field lengths, valid timestamps/time zones, and safe error responses. Add rate limiting and trusted proxy configuration before public deployment.
6. **Test negative cases.** Cover missing/expired tokens, invalid roles, inactive/revoked relationships, cross-client reads/writes, overlap races, database outages, malformed/oversized bodies, and no leakage of tokens, notes, SQL, or private records.
7. **Verify deployment configuration.** Configure secrets only in the server environment; verify allowed origins, HTTPS, health/readiness semantics, logging redaction, backups, retention, and a documented recovery plan.
8. **Run end-to-end tests with synthetic accounts.** Confirm client and caregiver permissions separately. Do not use real personal data until the access-control and recovery checks pass.

## Release gate

Only after the above is implemented and tested should the API advertise itself as configured or accept appointment, roster, relationship, or profile data. Keep `main` and production deployment unchanged until an explicit release decision.
