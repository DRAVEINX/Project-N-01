# NovaLife — release hardening checklist

This checklist tracks the work still required after the user reported that the Android phone and tablet builds install and all functions work on their devices. That report is valuable acceptance feedback, but it is not a substitute for automated regression evidence, independent review, or platform signing.

## Guardrails

- Work only on `feature/novalife-rebrand` until explicitly asked otherwise.
- Do not merge to or modify `main`.
- Preserve the separate Android phone/tablet application IDs, local storage keys, encryption identifiers, backup formats and migration behavior.
- Never commit signing keys, passwords, API tokens, or production environment files.
- Do not describe unsigned Windows/iOS outputs as production-ready or claim cloud sharing works until the backend is deployed and reviewed.

## Priority 1 — security and data integrity

- [ ] Inventory every persisted data category, including the original daily checklist/progress and accessibility preferences that remain outside the Daily Life Suite vault.
- [ ] Design and implement a non-destructive migration for any remaining plaintext personal data; retain a clear user-controlled rollback/export path and test upgrades from existing installations.
- [ ] Add or verify tests for wrong passphrases, tampered ciphertext, unsupported backup versions, malformed/oversized imports, storage quota errors, restore failures and recovery-code behavior.
- [ ] Review auto-lock, hidden/background transitions, key lifetime, and accidental sensitive data in logs, notifications, exports and crash output.
- [ ] Threat-model server accounts, email verification/reset, MFA, invitations, consent, rate limits, session revocation and encrypted sync before deploying the API.
- [ ] Obtain independent security/privacy review before real sensitive journal, voice, mood or caregiver records are used.

## Priority 2 — platform release readiness

- [ ] Android phone: verify installed package identity, app upgrade over an existing install, data preservation, backup/restore and permission behavior after reboot.
- [ ] Android tablet: repeat the same checks and validate portrait/landscape, large text, touch targets and TalkBack.
- [ ] Notifications: test exact-time delivery, reboot, time-zone/DST changes, denied permission, battery restrictions and duplicate scheduling.
- [ ] Windows: build MSI; install, launch from Start/Desktop, upgrade in place, verify data preservation, uninstall, and confirm expected data-retention behavior. Configure Windows code signing before public release.
- [ ] iOS: configure Apple signing and provisioning securely, produce a signed IPA/archive suitable for device installation, then test on a physical iPhone. An unsigned Xcode archive is not an installable release.
- [ ] Confirm all platform workflows run against the exact candidate commit and retain artifact links plus test results.

## Priority 3 — accounts and cross-device use

- [ ] Deploy the API only with HTTPS, PostgreSQL backups, verified email sender, secret management, monitoring, retention/deletion policy and incident response.
- [ ] Test registration, email verification, login/logout, password reset, MFA, rate limiting and session revocation.
- [ ] Test encrypted sync across two devices, offline edits, stale-version conflicts, restore and account deletion.
- [ ] Keep caregiver/parent/guardian access disabled as a real sharing capability until per-category cryptographic sharing and revocable authorization have been reviewed and tested.

## Priority 4 — accessibility and usability

- [ ] Test TalkBack and keyboard-only navigation with real users/devices; check focus order, labels, errors and announcements.
- [ ] Test large text, high contrast, reduced motion, audio recording/playback, drawing, photo attachment and storage-full error handling.
- [ ] Check calendar duplicate prevention, overlapping appointments, recurring entries, reminders and daylight-saving boundaries.

## Acceptance rule

A checkbox is marked complete only when there is evidence: a passing automated test/workflow, an artifact built from the candidate commit, or a documented hands-on test with platform and outcome. A green build alone does not prove installation, signing, privacy or production readiness.
