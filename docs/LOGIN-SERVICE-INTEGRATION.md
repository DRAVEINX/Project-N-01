# Login service integration contract

`src/server/login-service.js` provides framework-agnostic login orchestration. It queries trusted account storage, verifies passwords through an injected verifier, creates an opaque session, and fails closed on dependency/audit failures. Unknown accounts use an injected dummy hash to reduce obvious timing-based account enumeration. Login denial responses do not disclose whether an account exists or is disabled.

Before deployment:
- Supply a reviewed password hashing/verifying implementation (prefer Argon2id with parameters reviewed for the deployment); do not use the test verifier in production.
- Generate and store a real dummy hash with the exact same algorithm and parameters.
- Use the PostgreSQL account repository and a shared durable session store.
- Add HTTP endpoint integration with TLS, rate limiting, request-size limits, security monitoring, safe secret handling, and a reviewed logout/recovery flow.
- Audit callbacks must write to a durable, access-controlled audit store; do not log passwords, hashes, access tokens, or request bodies.
- Add real database tests and end-to-end security review before handling real care data.

This module does not hash passwords, issue cookies, implement an HTTP server, or make the prototype production-ready.
