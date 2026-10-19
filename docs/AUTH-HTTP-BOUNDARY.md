# NovaLife authentication HTTP boundary

`createAuthHttpHandler({ auth, rateLimit })` adapts the server-side authentication runtime to the Fetch API.

Supported routes:
- `POST /auth/login`: strict JSON containing only `email` and `password`; bounded to 8 KiB.
- `GET /auth/me`: validates an Authorization bearer token and returns the current minimal actor.
- `POST /auth/logout`: revokes the bearer-token session.

The handler applies no-store and basic response hardening headers, rejects malformed tokens and unsupported request bodies, and fails closed if the required rate limiter throws or denies a request. It never logs credentials or tokens.

## Hosting requirements

This is a handler, not a listening server or deployment. Mount it only behind HTTPS. Implement `rateLimit` in the trusted hosting layer using a reliable client/network identity; do not blindly trust caller-supplied forwarding headers. Add operational monitoring, secure secrets, database TLS/permissions, and request-size limits at the edge too.

Bearer tokens are returned to the caller. The hosting/client design must protect token storage and transport; do not place them in URLs or logs. This handler does not configure CORS, cookies, CSRF policy, account recovery, or a production rate-limit store. Do not handle real care data until those controls and independent security/privacy reviews are complete.
