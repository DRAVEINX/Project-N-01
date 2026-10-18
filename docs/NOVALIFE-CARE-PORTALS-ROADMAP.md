# NovaLife care and staff portal expansion

This specification is for the NovaLife expansion of Project N-01. It is inspired by publicly described workflows in Nedap Ons Medewerkerportaal and Caren; it is not a copy of their branding, source code, or proprietary interface.

## Scope

### Staff portal
- Personal start page with relevant notices and team updates.
- Personal and team roster views (day/week), with change indicators.
- Availability and absence requests with approval states.
- Timesheet/work-state entry, review, correction history, and sign-off.
- Staff directory with contact details, team, expertise, and optional profile photo.
- One-to-one and group messaging, attachments, read/unread state, and notifications.
- Central role/permission administration and account preferences.

### Client and care-network portal
- Client-controlled care page and personal story (text and photos).
- Appointment calendar combining client-created and organization-shared appointments, clearly labelled by source.
- Shared care plan, dossier entries, measurements and care reports only when the organization explicitly enables each category.
- Messages with care professionals and approved network members.
- Task/appointment coordination for family and caregivers.
- Invite/remove network members, individual accounts, delegated administrators, and granular view/edit permissions.
- Clear consent screen showing what is shared, with whom, and the ability to revoke future access.
- Strong authentication and step-up verification for sensitive records.

### Accessibility and user experience
- Dutch-first interface, adjustable text size, keyboard navigation, screen-reader labels, high contrast, and reduced motion.
- Clear role-specific home screens; simple language and confirmation before sensitive or destructive actions.
- Responsive phone, tablet, and desktop layouts.

## Implementation and safety requirements
1. Preserve existing routines, daily checklist, mood/journal/drawing features, encrypted local vault, and separate Android phone/tablet build flavors.
2. Build reusable modules with explicit data models, validation, empty/loading/error states, and automated tests.
3. Do not present local profile records as real authenticated accounts. Real invitations, messaging, organization connections, and cross-device access require a trusted backend, authenticated identity, server-side authorization, audit logs, and revocation.
4. Keep care/health information private by default. Enforce least privilege server-side, encrypt transport and storage, minimize data, and record access to sensitive records.
5. Do not claim a direct Nedap Ons or Caren integration unless an authorized, documented API/partner connection is actually available and tested. Import/export or manual entry must be clearly distinguished from live synchronization.
6. No claim of MedMij compliance, government acceptance, clinical suitability, or production readiness without the applicable formal assessment and independent review.
7. Never place credentials, production health data, or signing secrets in source control.

## Delivery sequence
- Phase A: inspect current Daily Life Suite and map existing components to this scope; record gaps without removing existing functionality.
- Phase B: implement local-first staff portal UI and data models, then tests.
- Phase C: implement client care-network UI, consent/permissions UX, and tests.
- Phase D: design and implement secure backend identity, invitation, authorization, audit, and sync before enabling remote sharing.
- Phase E: run CI, verify Android phone and tablet separately, then Windows; verify iOS separately if targeted. Test accessibility, backup/restore, migration, and privacy before release.

## Acceptance checklist
- Existing app features remain available.
- Every role sees only the features and records it is authorized to access.
- Staff can create/edit a roster and timesheet with visible status and audit history.
- Clients can manage appointments, story, messages, and network permissions.
- Disabled sharing means no care data is transmitted.
- Revoked access takes effect server-side.
- Automated tests cover permissions, consent, validation, import/export, and regressions.
- CI passes; real-device tests and security/accessibility reviews are documented.
