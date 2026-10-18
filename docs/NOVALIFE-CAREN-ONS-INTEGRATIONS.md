# NovaLife integrations: Caren and Nedap Ons®

Status: integration design only. This document does not mean a live connection is active.

## Product decision
NovaLife must explicitly include both:
1. **Caren** for the client, family, and informal-care network workflow.
2. **Nedap Ons®** for authorized staff/organization workflows and approved data exchange.

NovaLife should have its own user experience while clearly identifying information that comes from Caren, Ons, or NovaLife itself. Do not copy vendor logos or imply endorsement.

## Caren integration
Caren is an existing Nedap digital care environment. A real organization connection and its sharing settings must be configured through the official Caren/Ons process. The application must not try to impersonate Caren users or collect Caren passwords.

Planned NovaLife experience:
- A clearly labelled **Caren openen** action linking to https://caren.nl/.
- A **Caren-koppeling** status page with states: not configured, awaiting organization setup, active (only after verified configuration), unavailable, and disconnected.
- Explain that appointments, messages, and dossier details can only be shown in Caren when the care organization has enabled those categories and the client has been linked through the official flow.
- Do not scrape Caren pages or claim a live API sync without an authorized documented integration.

## Nedap Ons integration
A real Ons API integration requires NovaLife to register as an external software supplier, follow the current Ons API onboarding/review process, obtain the appropriate organization approval in Ons Podium, and implement the approved API specification and certificates.

Planned NovaLife experience:
- A clearly labelled **Nedap Ons openen** action linking to https://nedap-ons.nl/.
- An **Ons-integratie** settings page with organization, approved scopes/data categories, connection status, last successful sync, and disconnect/contact guidance.
- Use a server-side adapter only; never place API certificates, client secrets, or production credentials in browser/mobile source code or GitHub.
- Start with the minimum approved scopes, server-side authorization checks, audit events, error handling, retry/backoff, and data provenance labels.
- Never mark the integration active until a real approved connection has passed an authenticated health check.
- Do not invent endpoints. Implement only endpoints listed in the current official Ons API documentation and explicitly approved for the participating organization.

## Shared data and consent
- Consent is granular by category (for example appointments, messages, dossier summaries, contact details).
- Access is checked on every server request, not just by hiding UI controls.
- Store consent version, actor, timestamp, scope, and revocation timestamp.
- Revocation must stop subsequent access/synchronization; follow the provider's own disconnection process too.
- Keep provider data separate from NovaLife-created data and show the source.
- No sensitive care information in analytics, logs, crash reports, test fixtures, or public issues.
- Encrypt transport and storage, rotate credentials, maintain least-privilege service identities, and test tenant isolation.

## Delivery gates
1. **UI only:** add navigation and connection status/settings without claiming a connection.
2. **Provider onboarding:** complete supplier/partner application and organization approvals for both services where required.
3. **Sandbox/test:** implement approved endpoints with synthetic data and contract tests.
4. **Security:** test authentication, authorization, tenant isolation, consent, revocation, audit logging, certificate rotation, and failure behavior.
5. **Pilot:** verify with a participating care organization and provider.
6. **Release:** enable production only after written authorization, security/privacy review, operational monitoring, and acceptance tests.

## Official references
- Nedap Ons API integrations: https://support.nedap-ons.nl/support/solutions/articles/103000273959-api-koppelingen
- Nedap Ons integration overview: https://nedap-ons.nl/starten-met-nedap-ons/koppelen/
- Caren overview from Nedap Ons: https://support.nedap-ons.nl/support/solutions/articles/103000266170
- Caren official portal: https://caren.nl/
- Nedap Ons official site: https://nedap-ons.nl/

## Acceptance checklist
- Both Caren and Nedap Ons appear as distinct integration options in NovaLife.
- Each status accurately distinguishes demo/configuration from a verified live connection.
- No passwords are collected or stored for either provider.
- No data is imported until an approved authenticated connection and consent are in place.
- API secrets stay on the server and out of source control.
- Automated tests cover inactive, pending, active, failed, and disconnected states.
