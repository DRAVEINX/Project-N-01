# Account API and encrypted sync setup

This guide describes the account/sync prototype. It is a deployment checklist, not a security certification or approval to store real sensitive data.

## What the current branch implements

- Server-side account registration with scrypt password hashes; plain passwords are never written into the account database.
- Bearer sessions that expire after seven days; the app UI drops the in-memory token after 15 minutes of inactivity. A stolen live bearer token can still be replayed until it expires or is revoked.
- Optional TOTP authenticator codes.
- Single-use, 30-minute password-reset tokens, delivered through a configured outbound webhook.
- An authenticated API that accepts only versioned AES-256-GCM vault envelopes and uses revision numbers to return an explicit 409 sync-conflict; it never silently overwrites a changed server revision.
- Separate account deletion for server-side account/session/reset/invite/sync data. Device-local vaults and downloaded backups must be removed separately on each device.
- Role/scope invitation metadata and acceptance. The present branch does not grant invited accounts access to another person's encrypted vault payload. Do not promise shared caregiver/guardian data access until encrypted sharing/key exchange and server-side authorization are implemented and independently tested.

## Local development

Requires Node.js 22 or newer.

Run the web preview:

npm install
npm run serve

In a second terminal, start the API with a local-only secret of at least 32 characters:

PROJECT_N01_SERVER_SECRET="local-only-secret-at-least-32-characters" PROJECT_N01_DB_PATH="$HOME/.project-n01-dev/project-n-01-db.json" HOST=127.0.0.1 PORT=4180 npm run serve:api

If testing from the separate web preview at http://localhost:4173, set PROJECT_N01_CORS_ORIGINS=http://localhost:4173 before starting the API. Then set the project-n01-api-base meta element in index.html to http://localhost:4180/api for local testing only. Do not commit production secrets or public production endpoints to the source tree. For production, serve the web app and API behind HTTPS and set the API base to the deployed /api route.

The default database path is under the current operating-system user home directory in .project-n-01, outside the repository web root. Keep it private, never point it into a directory served to users, and keep a protected backup with rehearsed restoration.

## Required server configuration

- PROJECT_N01_SERVER_SECRET: unique high-entropy value of at least 32 characters. Required in production; also needed for two-factor setup. Store in the host's secret manager, not GitHub source.
- PROJECT_N01_DB_PATH: private persistent data file path. The current file-based database is only a single-process prototype. Do not run multiple API instances against the same JSON file.
- PROJECT_N01_CORS_ORIGINS: exact comma-separated origins of the installed web frontend, with scheme and port. Do not use *.
- PROJECT_N01_PUBLIC_APP_URL: externally reachable HTTPS frontend URL used to build reset and invitation links.
- PROJECT_N01_DELIVERY_WEBHOOK_URL: a trusted HTTPS webhook endpoint that accepts a JSON object with type, to, and either resetUrl or invitationUrl, plus expiry metadata.
- PROJECT_N01_DELIVERY_WEBHOOK_TOKEN: optional bearer token used to authenticate the delivery webhook.
- NODE_ENV=production: enables required secret validation. Terminate HTTPS at a trusted reverse proxy and do not expose the raw API over the public internet.

The outbound webhook must deliver email through a provider you control. Protect its credentials, reject unknown type values, avoid logging reset/invitation URLs or tokens, and do not echo secrets in error responses. Account recovery is unavailable until the webhook and public URL are configured. Resetting the account password does not reset the separate local vault passphrase.

## How to test sync

1. Create a local vault and keep its passphrase available.
2. Create an account through Accounts & synchronisatie.
3. Choose Cloudversie controleren before pushing anything.
4. Upload only if the app confirms that the cloud revision has not changed. A changed revision produces a conflict and is not silently replaced.
5. To restore a cloud vault on another device, log in to the same account and choose Cloudversie downloaden en lokaal vervangen. The app downloads a local encrypted backup before replacing the local envelope, then locks. Unlock the downloaded vault with its own passphrase.
6. If two devices edited different copies offline, first download/export backups and decide which state to retain. This prototype does not yet provide item-by-item encrypted merge across devices.

## Before production use

The API stores records in a local JSON file and uses only in-process rate limits. It is not horizontally scalable and has no transaction-backed database, durable distributed rate limiter, monitoring/alerting, key rotation system or independently tested disaster recovery. Before storing real journal, mood, contact, caregiver or other sensitive information:

- move accounts, sessions, invites, resets and revision metadata to a managed database with transactions and unique constraints;
- store secrets in a KMS/secret manager and plan key rotation;
- validate an end-to-end threat model, rate limiting, email delivery, deletion semantics and encrypted backup restoration;
- review retention, exports, logging, access auditing and applicable privacy obligations with qualified reviewers;
- complete an independent security assessment and accessibility/usability testing on all supported platforms.

The app's current local encrypted vault still needs native platform key-storage integration (for example Android Keystore and the appropriate Apple keychain APIs). A web encryption envelope alone is not device-bound hardware protection.
