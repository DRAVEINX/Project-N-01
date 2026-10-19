# NovaLife server authorization integration contract

## Status and purpose

This document defines the minimum contract for replacing local profile/consent placeholders with authenticated multi-user access. It is a design and implementation checklist, not proof that a backend exists. The current application is a browser/Capacitor prototype with local encrypted storage; UI role checks and locally stored consent must never be treated as a server security boundary.

## Required trust boundaries

1. **Authenticate every request.** Resolve the actor from a verified server-side session or access token. Never accept an actor ID, role, active flag, provisioned flag, client assignment, granted scope, or administrator grant from request JSON as authoritative.
2. **Load authorization facts on the server.** Read current account status, role, caregiver-to-client assignment, consent scope, and revocation status from trusted storage for each protected operation. Do not trust cached values supplied by the client.
3. **Authorize before reading or changing data.** Call `authorize()` with the authenticated actor and server-loaded authorization facts before retrieving protected records or applying a mutation. Use an immutable client/account ID, not a display name or profile label.
4. **Scope every database query.** After authorization, constrain reads, updates, and deletes by the target client ID and resource ID. Never fetch a broad set of records and rely on the UI to hide other clients' records.
5. **Fail closed.** Missing identity, invalid role, missing assignment, missing consent, revoked consent, unknown resource/action, or an authorization lookup error must not allow access.
6. **Keep authorization and mutation consistent.** Where possible, re-check assignment/consent and apply the write in one transaction, or use a concurrency-safe policy that prevents a revoked permission from racing with a write.
7. **Audit sensitive actions.** Record actor ID, target client ID, resource type/ID, action, timestamp, outcome, and a request/correlation ID. Avoid logging mood text, journal contents, audio, passwords, tokens, recovery codes, or other unnecessary sensitive payloads.

## Role and permission rules

- **Client:** may create, read, update, or delete their own personal records according to product rules. A client may submit their own mood check-in. A client must not gain access to caregiver-only care records or privileged `manage` operations by owning a record.
- **Caregiver, parent, guardian:** may use the care portal, but may access a particular client's care resources only when the server confirms both an active assignment and unrevoked consent for the resource's scope. A role alone is insufficient.
- **Developer administrator:** must be explicitly provisioned by a trusted administrative process. Administrative screens do not grant routine access to client records. Exceptional support access requires a separately authorized, short-lived, audited grant with a reason and expiry.
- **Legacy local profiles:** missing `profileId` is treated as belonging to the original personal profile in the local prototype. That compatibility rule is not a server identity model and must not be reused as a substitute for account IDs.

## Resource scope map

The current policy module maps these resource families:

| Resource family | Required scope |
| --- | --- |
| Profile | `profile` |
| Mood report | `mood` |
| Journal and drawing | `journal` |
| Appointment | `calendar` |
| Weekly plan | `planning` |
| Guide | `guides` |
| Trusted contact | `help` |
| Care plan, note, task, report | `care` |
| Care document | `careDocuments` |
| Medication overview | `medication` |
| Care message | `careMessages` |
| Care roster | `roster` |
| Care team | `careTeam` |
| Consent record | `careConsents` |

Review this mapping with product/privacy owners before exposing endpoints. A UI feature must not automatically imply that a caregiver has permission to read or write its data.

## Endpoint implementation checklist

For every endpoint that touches personal or care data:

- [ ] Authenticate the request and reject expired/revoked sessions.
- [ ] Validate request schema, allowed fields, size limits, and resource IDs.
- [ ] Resolve actor role/status from trusted server data.
- [ ] Resolve the target client from the resource relationship; reject client-ID substitution.
- [ ] Load active assignments and current consent scopes from trusted storage.
- [ ] Call the policy before data access or mutation.
- [ ] Apply a client/resource-scoped database query and enforce field-level write allowlists.
- [ ] Enforce CSRF protection for cookie-based sessions, rate limits, and secure transport as appropriate.
- [ ] Audit allow and deny outcomes without recording sensitive content.
- [ ] Return a minimal response that does not reveal whether another client's record exists.
- [ ] Add tests for allowed access, cross-client access, missing/revoked consent, removed assignment, inactive account, malformed IDs, stale session, and authorization lookup failure.

## Required automated security tests

1. A client cannot read, update, or delete another client's personal record, even by changing an ID in the URL or request body.
2. A caregiver cannot read or mutate a client record without an active assignment and the exact required consent scope.
3. Revoking consent or removing an assignment immediately blocks subsequent requests.
4. A client cannot call caregiver-only routes even if the UI is manipulated or the route is invoked directly.
5. An administrator cannot read care records merely because they can access administrative screens.
6. Expired, malformed, or absent break-glass grants are denied; successful exceptional access creates an audit event.
7. Unknown actions/resources and server-side authorization lookup errors fail closed.
8. Tests verify that error responses and logs do not expose another client's data or sensitive note content.

## Release gate

Do not enable remote caregiver/guardian access or store real sensitive care information until an actual backend implements this contract, automated endpoint tests pass, and security/privacy review is complete. A green static/UI test or a passing pure-policy unit test alone does not meet this gate.
