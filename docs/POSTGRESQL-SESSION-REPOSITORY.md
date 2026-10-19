# PostgreSQL schema and session repository

## Scope

This change introduces a PostgreSQL schema foundation and an adapter for the existing durable-session repository interface. It is not a deployed database, complete API server, login system, or production approval.

## Schema

`migrations/0001_novalife_core.sql` defines:
- accounts with unique normalized email, password-hash field, active state, and constrained roles;
- session records that persist only a SHA-256 token digest, with expiry and account foreign key;
- caregiver/guardian assignment records;
- granular consent grants with expiry and revocation timestamps;
- minimal audit events without request bodies or care-note content.

The migration is an initial schema, not a complete migration framework. Review it with a database administrator before applying it to any environment containing personal data.

## Session repository adapter

`src/server/postgres-session-repository.js` accepts a node-postgres-compatible `pool.query` object and implements `put`, `get`, `delete`, and `deleteByActor`. It uses parameterized SQL and stores no raw bearer token. Database exceptions are allowed to propagate so callers can fail closed.

## Required next steps

1. Add the approved PostgreSQL driver and a deployment-specific connection factory; do not commit credentials.
2. Run the migration against a disposable PostgreSQL instance in CI and test the adapter against that real database family.
3. Implement trusted account repository and password verification with a reviewed password-hashing scheme, login/logout/recovery endpoints, rate limiting, and session revocation.
4. Connect every protected API endpoint to the authorization gate and enforce client assignments and consent in server-side queries.
5. Configure TLS, secret management, backups/restore, monitoring, audit retention, privacy review, and independent security testing.

Until these steps and the production release checklist are complete, use dummy test data only; do not store real care data.
