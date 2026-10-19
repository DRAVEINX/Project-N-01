# Durable session repository conformance checks

The durable session adapter deliberately depends on an injected repository rather than choosing a database vendor. Before a production repository is approved, its implementation must pass the same behavior checks as the shared-repository tests in `tests/durable-session-store-shared-repository.test.mjs`.

## Required guarantees

- **Shared visibility:** a session created by one application instance can be resolved by another instance using the same repository.
- **Immediate revocation visibility:** after a successful single-session or actor-wide revoke, another instance must no longer resolve the affected session.
- **No digest overwrite:** inserting a duplicate token digest must fail atomically; it must not replace an existing record.
- **Durable writes:** acknowledged session creation and revocation must survive the failure scenarios specified by the deployment's recovery objectives.
- **Fail closed on outages:** repository errors must propagate to the authentication boundary; callers must not be treated as authenticated when storage is unavailable.
- **Token minimization:** persist only the token digest, never the raw bearer token.
- **Trusted identity:** the session store's actor ID is not a role or permission. Each request must still reload current active-account status and role from a trusted account repository and pass through the authorization gate.

## Before production use

Run the repository conformance tests against the actual database adapter and test at least two independent adapter instances connected to the same backing service. Include concurrent duplicate insert attempts, concurrent revoke/resolve behavior, process restarts, database outages, and account disablement. Document transaction/isolation guarantees and define acceptable revocation latency.

The current shared-repository tests use an in-memory fixture to verify the adapter contract. They do **not** prove that a production database is configured, durable, distributed, or secure. No production database or account repository is included by this change.
