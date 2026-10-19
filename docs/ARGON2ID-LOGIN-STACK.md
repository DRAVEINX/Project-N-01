# Composed Argon2id login stack

`src/server/argon2-login-stack.js` wires the existing login orchestration, Argon2id password adapter, trusted account repository and durable session manager together.

The factory returns:
- `login({ email, password })` for login orchestration;
- `authenticate(token)` for server-side bearer-token validation against current account status;
- `revoke(token)` for logout/session revocation;
- `hashPassword(password)` for server-side account provisioning or password change workflows.

The caller must inject:
- a trusted account repository with `findCredentialsByEmail` and `loadActor`;
- a durable session repository with `put`, `get` and `delete`;
- a durable audit callback that never logs passwords, password hashes, bearer tokens or full request bodies.

## PostgreSQL wiring

Use `createPostgresAccountRepository({ pool })` and `createPostgresSessionRepository({ pool })` with the same reviewed, access-controlled PostgreSQL pool, then pass both repositories and the audit writer into `createArgon2LoginStack`. The caller remains responsible for database connection configuration and secret management.

## Not production deployment

This is server-side composition logic only. It does not create an HTTP endpoint, parse Authorization headers, issue cookies, provide TLS, rate-limit attempts, implement account recovery, or provision a production database. Add those controls and conduct an independent security review before handling real personal or care data. Never import this server module into browser or mobile client code.
