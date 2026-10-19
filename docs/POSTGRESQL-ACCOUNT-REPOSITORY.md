# PostgreSQL account repository adapter

This adapter provides trusted account lookups for the initial NovaLife PostgreSQL schema.

- `loadActor(id)` reads only the account ID, current role, and active state. This is suitable for injection into the session authenticator's trusted `loadActor` callback.
- `findCredentialsByEmail(email)` normalizes the email and returns the stored password hash only to the authentication service. It does not verify the password.
- `createAccount(...)` requires a caller-supplied password hash and does not accept plaintext passwords.

## Not yet production login

This is a repository adapter, not a complete account system. Before enabling login, implement and review password hashing/verification (for example, a properly parameterized Argon2id library), generic error responses, rate limiting, account enrollment and recovery, email verification if required, secure transport, secrets management, and integration tests against a real PostgreSQL instance. Do not expose `findCredentialsByEmail` directly as an API response or log its return value.

The adapter accepts an injected node-postgres-compatible pool; it does not connect to a database or deploy credentials. Tests use a fake pool and therefore do not prove real-database compatibility.
