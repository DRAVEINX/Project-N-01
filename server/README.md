# Project N-01 Cloud API

This is the server-side foundation for real accounts, optional TOTP two-factor authentication, email verification/password reset, household roles/consent records, and end-to-end-encrypted vault synchronisation.

## Requirements

- Node.js 22+
- PostgreSQL 14+ with permission to create tables and the `pgcrypto` extension
- An HTTPS deployment URL
- A Resend API key and verified `MAIL_FROM` sender for email verification, password reset and invitations
- Exact frontend origin in `APP_ORIGIN`

## Environment

Set these environment variables in your hosting platform, never in frontend files or Git:

- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: unique random secret of at least 32 bytes
- `APP_ORIGIN`: exact web app origin, e.g. `https://app.example.org`
- `PUBLIC_APP_URL`: full web app URL used in email links
- `RESEND_API_KEY`: email provider key
- `MAIL_FROM`: verified sender, e.g. `Project N-01 <no-reply@example.org>`
- Optional `PORT` (default 4180), `HOST` (default 0.0.0.0), `DATABASE_SSL=disable` only for local development

## Run

```sh
npm install
npm run migrate
npm start
```

The API refuses to start without its database, strong token secret, and frontend origin. Use TLS at the platform/reverse proxy. Do not expose PostgreSQL to the public internet.

## Important security model

- Passwords are stored as scrypt hashes, never plaintext.
- Email verification is required before a session is issued. Password reset links are random, one-use, hashed in the database, and expire after one hour. Email responses are generic to avoid account enumeration.
- Optional authenticator-code MFA uses TOTP. The TOTP secret is encrypted before being stored.
- Access tokens are short lived (30 minutes); logout revokes the server-side session.
- `/v1/sync/vault` accepts only recognised AES-256-GCM client-encrypted envelopes and stores the opaque envelope; the server does not decrypt it. Compare-and-swap `baseVersion` prevents silent overwrites. The 20 latest previous ciphertext versions are retained.
- Household membership and revocable category consent are separately recorded. The current single-envelope vault sync is per-account; it does **not** yet implement cryptographic sharing of individual categories between accounts. Do not represent a caregiver invite as permission to read another user's vault.
- Rate limiting is currently in-memory and per process. For multi-instance deployments, add a shared limiter/reverse-proxy protection and monitoring.
- This API has not had a third-party penetration test or security certification.

Do not put production health, journal, voice or caregiver records in the service until deployment configuration, TLS, database backups/retention, incident response, privacy assessment and independent security review are complete.
