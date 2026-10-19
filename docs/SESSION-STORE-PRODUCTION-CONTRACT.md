# Production session-store integration contract

## Status

This document specifies the adapter required to replace the in-memory development session store. It does not implement a database, login endpoint, cookie policy, or production authentication service. Do not treat the current in-memory store as suitable for production or multiple application instances.

## Required interface

The authentication composition currently depends on a session store with a `resolve(token)` method. A production adapter must preserve the security properties below:

- **Opaque credentials:** generate cryptographically random session tokens with sufficient entropy. Never encode user IDs, roles, permissions, or personal data into the token.
- **Digest-only persistence:** store a cryptographic digest of the token, not the raw bearer token. Compare digests without exposing token material in logs.
- **Expiration enforced server-side:** each session has an absolute expiry; expired sessions must resolve as absent even if cleanup has not run.
- **Revocation:** support revoking one session and all sessions for an actor. Revocation must take effect across all running application instances.
- **Atomicity:** session creation, revocation, and lookup must use datastore operations that do not permit a revoked or expired session to be accepted due to stale local state.
- **Account revalidation:** every authentication resolution must load the current actor from a trusted account repository and reject missing, disabled, roleless, or mismatched accounts. Never trust role or assignment data from request bodies or token contents.
- **Outage behavior:** if the session store or account repository is unavailable, fail closed with an availability error. Do not silently accept a cached actor or downgrade to unauthenticated local mode.
- **Secret handling:** never log raw tokens, authorization headers, passwords, session cookies, or request bodies that may contain sensitive care data.

## HTTP boundary requirements

- Use HTTPS/TLS in every non-local environment.
- Prefer secure, HttpOnly, SameSite cookies for browser sessions where the architecture supports them; if bearer tokens are used, define a secure token delivery and storage strategy for each client.
- Apply rate limits to login and recovery endpoints and monitor repeated failures.
- Validate origin/CSRF protections where cookie authentication is used.
- Use explicit token/session expiry and a documented logout/revocation flow.
- Restrict CORS to known application origins; do not combine wildcard origins with credentials.
- Keep authentication errors generic to avoid disclosing whether an account exists.
- Ensure logs have access controls, retention limits, and a documented review process.

## Required adapter tests before release

1. A valid unexpired token resolves to the current active account.
2. Unknown, malformed, expired, and revoked tokens are rejected.
3. Revocation is visible across independent adapter instances.
4. Disabling an account invalidates its existing sessions on the next resolution.
5. Changing an account role takes effect without reissuing a token.
6. Repository/store outages fail closed and never invoke a protected handler.
7. Parallel create/revoke/resolve operations cannot resurrect a revoked session.
8. Raw tokens and authorization headers are absent from logs and persisted records.
9. Session expiry and revocation work under the production datastore's actual consistency model.
10. Tests run against the same adapter and database family intended for deployment.

## Release gate

Do not enable real care records or call this production-ready until a durable adapter, trusted account repository, HTTP/TLS deployment, rate limiting, audit persistence, backup/restore, and independent security review are implemented and tested. The current in-memory store is for development and tests only.
