# PostgreSQL authorization-context loader

`src/server/postgres-authorization-context.js` loads active caregiver/guardian
assignments and unrevoked, unexpired consent grants from PostgreSQL. It is designed
to be passed as `loadAuthorizationContext` to the authorized-handler composition.

The caller must provide `resolveTargetClientId(actor, request)`. That resolver
must derive the target from trusted server-side resource relationships; copying a
client ID from an arbitrary body/query field is not sufficient. For personal
resources, resolve the actor's own immutable account ID. When no target applies,
return null.

Assignments are filtered by role, active state, validity start and expiry. Consent
is filtered by target client, grantee, grant time, revocation and expiry. Database
errors propagate so the authorization gate fails closed.

**Conservative scope rule:** the current policy has one general `care` scope for
care plans, notes, tasks and reports, while the schema stores those grants
separately. The loader only emits `care` when all four explicit grants exist; a
single grant never widens to all four resource families. Other schema scopes map
to their corresponding policy scopes. Consent for `care-consent-record` is not
enabled by this mapping because the current schema has no matching consent scope.

This loader does not create assignment/consent administration endpoints, perform
resource-specific CRUD, or replace transaction-level authorization checks. Review
and test all of those before enabling remote access to real care data.
