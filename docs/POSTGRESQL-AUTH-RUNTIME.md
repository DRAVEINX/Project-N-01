# NovaLife PostgreSQL authentication runtime

`createNovaLifePostgresAuth({ pool, audit, now, ttlMs })` composes the trusted PostgreSQL account repository, PostgreSQL session repository, Argon2id password verification, login orchestration and opaque session manager.

The returned object exposes:
- `accounts` for trusted server-side account provisioning;
- `hashPassword(password)` for creating Argon2id hashes before account creation or password changes;
- `login({ email, password })` for credential verification and session creation;
- `authenticate(token)` for validating a bearer token and checking current account status;
- `revoke(token)` for logout.

## Required deployment boundaries

- Supply a configured PostgreSQL pool from the server process. Keep credentials in a secret manager/environment, restrict database permissions, and use TLS when connecting across an untrusted network.
- Supply a durable audit writer with access controls. Do not log passwords, hashes, bearer tokens or request bodies.
- Call this module only from server-side Node.js code; never bundle it into web, Android, tablet or iOS client assets.
- Build a reviewed HTTP boundary separately: TLS, strict request parsing, rate limits, generic error responses, token transport protections, CSRF controls if cookies are used, monitoring, account recovery, and explicit logout.
- Run migration and real PostgreSQL integration tests before deployment. The CI integration test uses disposable PostgreSQL and synthetic accounts only.

This runtime is integration logic, not a deployed server or a declaration that NovaLife is ready for real client/care data. Complete threat modeling, privacy review, backup/restore testing, penetration testing and operational monitoring before production use.
