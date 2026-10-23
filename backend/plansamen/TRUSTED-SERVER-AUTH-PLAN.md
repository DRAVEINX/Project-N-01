# PlanSamen trusted-server authentication plan

Status: design and tests only; the API deliberately remains disabled until this design is implemented and verified.

## Required trust boundary

1. The server must validate every bearer token with Supabase Auth's server-side user endpoint (for example, `auth.getUser(token)`). Do not trust a decoded JWT, a request body role, `user_metadata`, or a client-supplied user ID.
2. Resolve the user's role and relationships from database records protected by RLS or a narrowly scoped server-only operation. Never accept `role`, `clientId`, `caregiverId`, or `createdByUserId` as proof of authority.
3. Use the Supabase publishable key only where it is appropriate for a client; keep any secret/service-role key exclusively in server-side secret storage. Never embed server secrets in Android assets, build artifacts, or logs.
4. For invitation, activation and revocation, require an authenticated, authorized actor; validate the target client and caregiver; record an audit event; and make changes transactional. A client must never activate a relationship for themselves by writing a relationship row.
5. Re-check active relationship state during the same transaction as appointment/roster writes. Preserve database exclusion constraints as the concurrency-safe final guard.
6. Return minimal error responses with request IDs. Never log bearer tokens, notes, appointment titles, or other sensitive user content.
7. Keep `acceptsPersonalData: false` and all `/api/*` data routes disabled until the items below are complete.

## Implementation and verification checklist

- [ ] Pinned Supabase client dependency and committed lockfile.
- [ ] Server-only environment validation for Supabase URL and publishable key; optional server secret only when a privileged operation truly requires it.
- [ ] Bearer-token verification via Supabase Auth and rejection tests for missing, malformed, expired and revoked sessions.
- [ ] Role lookup from trusted profile/database state; request body cannot escalate a role.
- [ ] Server-side relationship invitation/activation/revocation workflow with authorization checks and audit record.
- [ ] Tests for client A being denied client B's profile/appointments, unrelated caregiver being denied, revoked caregiver being denied, and parent/guardian permissions being explicit rather than assumed.
- [ ] Integration tests against a disposable Supabase project using synthetic users and no real personal data.
- [ ] CI and Android builds green after changes; independent security-advisor review.
- [ ] Only then consider enabling a limited authenticated endpoint. Never switch the health response to claim configured until real startup checks confirm it.

## Current status

The prototype API remains fail-closed: `backendConfigured: false`, `acceptsPersonalData: false`, and API routes return HTTP 503. This is intentional until server authentication and data access have been integrated and tested.
