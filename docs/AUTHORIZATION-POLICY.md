# Authorization policy module — implementation boundary

`src/authorization-policy.js` is a pure, deny-by-default policy function with unit tests. It defines the intended decision rules for client-owned personal records, assigned-caregiver access, explicit consent scopes, a provisioned developer administrator, and time-limited audited support access.

## Critical boundary

This module is **not yet wired to an authenticated server API** and does not authenticate sessions, fetch authoritative assignments/consents, write audit logs, or secure local browser records by itself. It is a testable foundation, not a production security control until every API endpoint calls it with server-verified identity and current authorization data.

Before real client data is supported:
1. Implement server-side identity, secure sessions, password hashing, rate limiting and account recovery.
2. Load roles, assignments and unrevoked consent from trusted server storage; never accept these fields from the browser request body.
3. Call `authorize()` on every read, write, export, upload and deletion endpoint, including indirect/nested resources.
4. Persist an audit event for allowed and denied sensitive actions. Admin support access must have a real approval workflow, expiry, reason and immutable audit record.
5. Add database isolation, encryption in transit/at rest, backup/restore, retention/deletion policy, incident response, monitoring and independent security review.
6. Test horizontal privilege escalation, revoked consent, account suspension, session revocation and cross-client access at API level.

The local encrypted-vault prototype remains single-device and is not suitable for production care records. Passing these unit tests does not change that status.
