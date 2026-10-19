# PostgreSQL integration CI

The dedicated GitHub Actions workflow starts a disposable PostgreSQL 16 service, applies `migrations/0001_novalife_core.sql`, and runs the account/session repository integration test against that actual database.

- The CI database is ephemeral and contains synthetic test data only.
- The test uses a dummy password-hash-shaped value; it does not implement or validate password hashing.
- The test is skipped in ordinary `npm test` runs when `DATABASE_URL` is not set.
- The workflow installs `pg` only in its runner with `--no-save --package-lock=false`; it does not change the application's declared runtime dependencies.
- A green run validates this migration and the exercised repository paths against PostgreSQL 16, not deployment, backups, TLS, real authentication, or production security.
