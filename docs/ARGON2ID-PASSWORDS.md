# Argon2id password utilities

The server-only module `src/server/argon2-passwords.js` uses the maintained `argon2` package and Argon2id with a 19 MiB memory cost, two iterations, and one lane. It exports password hashing, verification, and a startup adapter that creates an in-memory dummy hash using the same settings.

## Integration

At server startup, await `createArgon2PasswordAdapter()` and inject its `verifyPassword` and `dummyPasswordHash` into `createLoginService`. Use `hashPassword` only in a trusted server-side account provisioning/password-change flow. Never hash or verify account passwords in browser or mobile client code.

The adapter does not add an HTTP endpoint, database deployment, rate limiting, password recovery, or production secrets/configuration. Keep login behind HTTPS, add per-account and per-source rate limiting, and complete a security review before handling real user or care data.
