# PostgreSQL-backed authorized handler composition

This module composes the existing PostgreSQL/Argon2id session runtime with the
existing deny-by-default authorization gate in `src/server/authorized-handler.js`.

## Required deployment dependencies

- `pool`: configured PostgreSQL pool using private credentials and appropriate TLS.
- `authAudit`: durable audit callback for authentication events.
- `authorizationAudit`: durable, access-controlled audit callback for allowed and
  denied authorization decisions. If it fails, the protected handler is not called.
- `extractToken(request)`: extracts a verified opaque session token from the
  request transport. It must not derive identity or roles from user-controlled data.
- `loadAuthorizationContext(actor, request)`: reads current target client ID,
  active assignments, unrevoked consent scopes and any separately approved,
  time-limited support grant from trusted storage.
- `handler(request, context)`: performs a resource-scoped operation only after
  authorization succeeds.

## Security behavior

Authentication failures deny access. Authorization-context lookup failures return
503 and fail closed. A denied policy decision is audited and returns 403. Audit
failure prevents the protected handler from running. The factory does not supply
a default token extractor, authorization database queries, HTTP listener, HTTPS,
CSRF controls, or deployment rate limiting: the hosting service must implement
those explicitly.

A role label alone is not enough for caregiver access. Care-resource access still
requires current server-loaded assignment and consent for the relevant scope.
Developer-admin provisioning is not inferred from a role name. This integration
primitive is not a production deployment certification and must not be used with
real care data until the trusted adapters, endpoint isolation, privacy review,
and security testing are complete.
