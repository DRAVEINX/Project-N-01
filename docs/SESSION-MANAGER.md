# Session manager

`src/server/session-manager.js` provides opaque bearer-session lifecycle logic over an injected durable repository and trusted account repository.

- Generates 256-bit random base64url bearer tokens.
- Persists only a SHA-256 digest of each token; the raw token is returned only at creation.
- Checks the current trusted account and active status at creation and authentication.
- Rejects malformed/unknown tokens, expires sessions and removes expired or deactivated-account sessions.
- Supports revocation and configurable expiry from one minute up to 30 days (default: 8 hours).

## Integration contract

Pass the PostgreSQL session repository as `sessionRepository` and the trusted PostgreSQL account repository as `accountRepository`. The account repository's `loadActor` must use authoritative database data, never request-supplied roles.

This module does not parse HTTP headers, set secure cookies, provide CSRF protections, add rate limits, or configure a database connection. Production integration must use HTTPS, appropriate token transport, rate limiting, security monitoring, reviewed logout/recovery behavior, and deployment-specific expiry policy. Do not log bearer tokens or use this prototype with real care data before independent security review.
