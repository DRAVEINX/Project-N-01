# NovaLife care API deployment gate

This document describes what must be supplied by a real hosting environment before the caregiver portal may be enabled. The browser preview server in `scripts/serve.mjs` serves static files only; it is not the care API server.

## Current state

- The framework-neutral care API router, PostgreSQL repositories, Argon2id login/session stack, authorization context loader and Node HTTP adapter are implemented as modules.
- The browser portal is wired into `index.html`, but it remains disabled until `window.NOVALIFE_CONFIG.careApiBaseUrl` is set to a real HTTPS API origin.
- No production API origin, database credentials, trusted target resolver, audit sink, account-provisioning workflow or hosting environment is configured by this repository.
- Passing CI does not prove production hosting, account assignment, consent or real-device end-to-end behavior.

## Required host composition

The host must construct one long-lived PostgreSQL pool and one router using `createNovaLifeCareApiRouter` from `src/server/care-api-router.js`. It must provide:

1. **Private database connection:** credentials injected by the host's secret manager, TLS verification enabled where supported, connection/pool limits, and network access restricted to the API service.
2. **Durable audit callbacks:** `authAudit` and `authorizationAudit` must persist allow/deny outcomes to access-controlled storage. They must never record passwords, bearer tokens, full health/care payloads or secrets. A failing audit write must fail closed.
3. **Bearer-token extraction:** `extractToken` must accept only a well-formed `Authorization: Bearer <token>` header, reject duplicates/malformed headers, and never read tokens from URLs, cookies or request bodies.
4. **Trusted target resolution:** `resolveTargetClientId(actor, request)` must resolve the target from trusted server-side relationships. For the `/api/care/clients/:clientId/...` route, treat the path client ID as an untrusted selector only. Verify that the authenticated actor is linked to that client in trusted account data; never trust IDs or roles from the body.
5. **Authorization and consent:** the authorization context must confirm the active, time-valid assignment and current, unrevoked consent for the requested data scope on every operation. Deny by default when assignment, consent, client identity or audit state is missing or ambiguous.
6. **Secure HTTP boundary:** pass requests through `handleNodeCareApiRequest` only behind verified HTTPS. Configure exact allowed browser origins, keep `allowMissingOrigin` false for browser deployment, and validate any trusted-proxy/TLS callback against the actual hosting topology.
7. **Abuse controls:** add rate limits for login and mutation routes, request/read timeouts, maximum header sizes, connection limits, security monitoring and a tested incident response process.
8. **Account lifecycle:** provision accounts through a private administrator/invitation process with identity verification, least privilege, password policy and a way to revoke accounts and assignments. Public registration and self-assigned caregiver roles are not allowed.
9. **Migrations and operations:** apply reviewed migrations in order; use a least-privileged database role; back up and test restore; document retention/deletion; test audit durability and database outage behavior.
10. **Client configuration:** only after the API is deployed and tested, inject `window.NOVALIFE_CONFIG = { careApiBaseUrl: "https://<actual-api-origin>" }` before `src/care-portal-ui.js` loads. Replace the placeholder with the real HTTPS origin; never put database credentials or server secrets in frontend configuration.

## Required acceptance tests before enabling real users

- Login succeeds only for active accounts with valid passwords; unknown, disabled and wrong-password cases return generic errors.
- Tokens expire, logout revokes tokens, account deactivation invalidates active sessions, and switching accounts clears the previous in-memory session.
- Client, caregiver, parent, guardian and administrative roles are tested with separate accounts. A client cannot read or infer caregiver-only data by changing the UI or calling the API directly.
- Caregiver/parent/guardian requests are denied for unassigned clients, expired assignments, revoked/expired consent, insufficient scopes and cross-client record IDs.
- Missing or failed audit storage, database outages, malformed origins, non-HTTPS requests, invalid tokens and oversized payloads fail closed without leaking personal data.
- Android phone and tablet are tested separately on real devices; keyboard, TalkBack, text scaling, logout, token expiry and network interruption are verified.
- An independent security/privacy review and a data-protection assessment are completed before real sensitive care data is stored.

## Release rule

Do not enable the online portal for real users, advertise it as a production care system, or submit a public release until the host composition and acceptance tests above are implemented and independently verified. Existing local mood reporting remains separate from the caregiver API; do not imply that an online mood endpoint exists until a separately authorized and tested route is delivered.
