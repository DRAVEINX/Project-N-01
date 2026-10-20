# NovaLife care API deployment gate

This document separates the existing browser prototype from the private server that can serve the online care portal. `scripts/serve.mjs` is a static preview server; it is not the care API.

## Current state

- The framework-neutral router, PostgreSQL account/session/care-record repositories, Argon2id login stack, authorization-context loader, target resolver and Node HTTP adapter are implemented and covered by tests.
- `src/server/postgres-audit-repository.js` persists whitelisted authentication and authorization events. The API waits for audit writes and fails closed when persistence fails; event payloads, passwords and bearer tokens are not written to the audit table.
- `scripts/novalife-care-api-server.mjs` composes the HTTP adapter, router, PostgreSQL pool, audit writer, bearer-token extractor and trusted target resolver.
- `migrations/0001` through `0009` contain the intended schema, API helper hardening, public-table privilege lock-down and a restricted server role. A role password is deliberately not stored in source control.
- All six NovaLife tables in Supabase have RLS enabled and no direct table grants for `anon`, `authenticated`, or `service_role`. The API role receives only the table operations that its routes need.
- The online portal remains disabled until a real HTTPS API origin is deployed and tested. CI success does not prove production hosting or end-to-end behavior.
- No production API host, rate limiter at the ingress layer, verified origin list, account-provisioning process or independent security/privacy review has been completed.

## Restricted database role

The `0009_novalife_restricted_api_role.sql` migration creates a dedicated `novalife_api` login role with no superuser, database-creation, or role-creation powers. It has `BYPASSRLS` only because the API's tables currently have no SQL policies; its explicit grants are limited to six NovaLife tables. This is not a reason to expose that account directly to a browser or mobile app.

Before any host starts:
1. Apply and verify the reviewed `0009` migration.
2. Set a strong password for `novalife_api` using Supabase's role-management UI. Do not put the password in GitHub, a chat message, a saved SQL query, or frontend configuration.
3. Store the private connection string only in the API host's secret manager as `DATABASE_URL`. Configure the connection string to authenticate as `novalife_api`, not `postgres`, `supabase_admin` or `service_role`.
4. The server verifies the current database identity and a strict privilege matrix on startup. It refuses to start if the connection is privileged or the grants are wider than expected. TLS certificate verification is enabled by the server.

The API role is powerful enough to bypass RLS on tables for which it has grants. The API's authorization code must therefore remain server-only, and all routes must verify the active actor, client assignment, consent scope and durable audit result on every protected operation. Independent security review is required before sensitive data is used.

## Host configuration

Use Node.js 22 or newer. Start with `npm run serve:care-api`. Inject settings through the host's secret manager/environment; do not commit a real `.env` file.

Required settings:
- `DATABASE_URL`: private PostgreSQL connection URI authenticated as `novalife_api`.
- `ALLOWED_ORIGINS`: comma-separated, exact origin strings. Include the actual HTTPS web origin plus the exact origins used by the native builds, such as `capacitor://localhost` and `http://localhost`. Never use `*`.
- `PORT`: port supplied by the host.
- For production, configure either direct TLS with both `TLS_KEY_PATH` and `TLS_CERT_PATH`, or set `NOVALIFE_TRUST_PROXY=true` only when the platform makes the app port unreachable except through a trusted TLS-terminating proxy and overwrites `X-Forwarded-Proto`.
- `NOVALIFE_EXTERNAL_RATE_LIMIT_CONFIRMED=true` only after the host/ingress has real rate limits configured for login and mutation routes. The server deliberately refuses production startup without this explicit confirmation.
- Optional `DATABASE_POOL_SIZE` (1–20; default 5). Connection and SQL timeouts are bounded in the server.

See `deploy/novalife-care-api.env.example` for placeholders only. `/healthz` is a liveness response and does not reveal database details.

## Required host composition and account operations

- Provide a private database connection with TLS verification, restricted network access, connection limits and tested backups/restores.
- The audit store must be durable and access-controlled. Never write passwords, bearer tokens, entire care payloads or secrets to logs.
- Bearer tokens are accepted only from a single, well-formed `Authorization: Bearer` header; never accept tokens from a URL, cookie or request body.
- Use `createCareTargetResolver` and the authorization gate; never trust role, client ID, assignment or scope values sent in a request body.
- Enforce rate limits in the hosting ingress, request/read timeouts, header limits, security monitoring and a tested incident-response process. The app-level SQL timeout and HTTP body limits are not substitutes for host-level protections.
- A private, audited CLI is available to create client, caregiver, parent and guardian accounts: `npm run provision:care-account`. It asks for the password without echoing it and commits account creation with its audit event in one transaction. Configure `NOVALIFE_ADMIN_DATABASE_URL` and `NOVALIFE_OPERATOR_ID` only in a secure local environment; never use the API host's `DATABASE_URL` for this command. This CLI does not create developer-admin accounts, client assignments or consent grants. Public registration and self-assigned caregiver, parent, guardian or admin roles are prohibited. The API role cannot insert accounts, change roles, create assignments or grant consent.
- Keep the frontend portal disabled until API deployment and all required acceptance tests have passed. Then set `window.NOVALIFE_CONFIG.careApiBaseUrl` to the actual HTTPS API origin before `src/care-portal-ui.js` loads. Never place database credentials or server secrets in client configuration.

## Acceptance tests before real users

- Valid/invalid login behavior, inactive accounts, token expiry/revocation, account switching and session deactivation.
- Client, caregiver, parent and guardian roles tested using separate accounts and realistic assignments/consents.
- Denials for unassigned clients, expired assignments, revoked/expired consent, missing scopes and cross-client record IDs.
- Audit outage, database outage, invalid token/origin, non-HTTPS transport, oversized payloads and rate-limit behavior fail closed without leaking care data.
- RLS enabled and API-table grants verified against the intended privilege matrix. Confirm ordinary Supabase API roles cannot read or write NovaLife tables.
- Android phone and tablet tested separately on real devices; keyboard, TalkBack, text scaling, logout, session expiry and network interruption verified.
- Independent security/privacy review and a data-protection assessment completed before real sensitive care data is stored.

## Release rule

Do not enable the online portal for real users, describe the app as a production care system, or submit a public release until the deployment and acceptance criteria above are independently verified. Existing local mood reporting remains separate from the caregiver API: an endpoint existing in the router does not mean the Android app is already wired to a deployed backend.
