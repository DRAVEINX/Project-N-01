# Project N-01 — complete implementation and release plan

This is the single release-control checklist for completing the product, not a claim that unchecked work is implemented. Work stays on `feature/professional-suite-priority-1`; do not merge to `main` or modify MoodPress, KlaarKompas, CreatorNexus, or any other repository as part of this project.

## Release rule

A feature is **green** only when all relevant automated tests pass, the implementation is present, data survives restart/restore where promised, accessibility has been exercised, and each supported platform has passed its own acceptance checks. A green build alone is not proof of a working release. Use **red** for a known defect and **not tested** when evidence is missing.

## Workstream A — baseline and regression safety

- [x] Preserve the original app views and isolate the new Daily Life Suite.
- [x] Keep Android phone and tablet as separate app variants with separate identities.
- [x] Run the existing regression workflow successfully on the current baseline (see GitHub Actions run 39104320840).
- [ ] Run the full current test suite locally and in CI after each implementation batch.
- [ ] Add regression tests for every fixed defect and every new storage/auth/sync behavior.
- [ ] Add a single status report linking the exact commit and workflow for each candidate.

## Workstream B — daily-life features

- [ ] Agenda: create/edit/delete, day/week/month, timezone/DST handling, recurrence editing/cancellation, duplicate start prevention, overlap confirmation, travel/location/preparation notes, export/import.
- [ ] Reminders: schedule/edit/cancel/snooze/complete, no duplicate delivery, permissions and quiet hours, reboot/timezone/DST tests, reliable native scheduling on Android; define Windows/iOS behavior separately.
- [ ] Support roster: worker name/photo/role, dated shifts, recurring schedules, replacements/absence, editable day/week views, validated image sizes and persistence.
- [ ] Journal and mood: create/read/edit/delete, optional audio, transcription with explicit privacy notice, drawings via touch/mouse/stylus, attachment limits, encrypted persistence, encrypted backup/restore and confirmed deletion.
- [ ] Guides and routines: step-by-step text/photo/audio, progress persistence, search, duplicate detection, robust import/export and migration from legacy routines.
- [ ] Goals and weekly plan: goals, small steps, check-off, progress summaries and persistence through restart, backup and restore.
- [ ] Trusted contacts and safety card: explicit consent, confirmation before opening dialer/messaging, no claim that calls/messages were sent or emergency services dispatched.
- [ ] Data inventory and recovery: clear per-category storage status, safe restore choices, clear errors for quota/storage failures, export/delete controls and audit trail without recording secrets.

## Workstream C — accessibility and usability

- [ ] Test TalkBack on real Android phone and tablet; verify order, labels, status announcements and touch target sizes.
- [ ] Test keyboard-only navigation and focus order on desktop; no keyboard traps.
- [ ] Test large text, magnification, high contrast, reduced motion, portrait/landscape and tablet-wide layout.
- [ ] Review Dutch and English strings, empty/error/success states and plain-language instructions.
- [ ] Conduct usability sessions with people who have different reading, writing, vision, motor and cognitive-access needs before public release.

## Workstream D — security and data protection

- [ ] Complete a documented threat model and independent security review.
- [ ] Migrate remaining sensitive legacy data out of plaintext storage; preserve a deliberate, validated migration and rollback path.
- [ ] Verify all sensitive suite records and attachments are persisted only in the intended encrypted store; test lock, page-hide, timeout, wrong passphrase, tampered ciphertext, invalid format, storage quota and recovery.
- [ ] Keep keys/passphrases out of logs, source control, URLs, analytics and exported metadata.
- [ ] Validate backups against schema/version/size limits before changing active data; test merge and replace with clear confirmation.
- [ ] Review browser, Android, Windows and iOS key protection separately; browser encryption does not prove native-storage encryption.
- [ ] Complete privacy notice, retention/deletion behavior, consent revocation and incident-response/deployment checklist before real sensitive records are used.

## Workstream E — real accounts and household access

- [x] Initial API source exists for verified-email accounts, password reset, optional TOTP MFA, sessions, households/consent and encrypted-vault versioning.
- [ ] Add/verify automated API tests for email verification, expired/reused reset tokens, MFA failures, session revocation, rate limits, malformed payloads and authorization boundaries.
- [ ] Deploy API only with HTTPS, production PostgreSQL, migrations, verified mail sender, strong environment secrets, backups, monitoring and shared rate limiting.
- [ ] Verify role-based access server-side on every protected route; UI hiding is not authorization.
- [ ] Test invitations with separate real test accounts and devices; consent revocation must take effect server-side.
- [ ] Do not enable cross-account sharing of journal/calendar/voice content until a reviewed cryptographic sharing protocol exists.
- [ ] Test encrypted sync on two devices, offline edits, stale base versions, conflicts, retry, restore and account deletion; conflicts must never silently overwrite data.

## Workstream F — platform release candidates

- [ ] Android phone: build, install, launch, rotate, offline startup, upgrade, backup/restore, notification reboot/DST behavior, TalkBack, uninstall.
- [ ] Android tablet: separate package identity, full/wide layout, rotation, accessibility, notifications, upgrade and uninstall.
- [ ] Windows: install from MSI, launch from desktop and Start menu, resize/high-DPI, offline behavior, upgrade/uninstall, signing.
- [ ] iOS: native project configuration, provisioning/signing, install on a real supported device, permissions, notifications, backup/restore and App Store requirements.
- [ ] Sign distributable releases with the correct platform certificates and verify signatures. Unsigned CI artifacts are test candidates only.
- [ ] Verify each final artifact checksum, version, package identity and installation on target hardware before release.

## Current known blockers

- API source is not a deployed production service merely because it exists in Git.
- Cross-device sync depends on deployment and two-device testing; local export/import is not automatic sync.
- Native reminder scheduling still requires physical-device validation, including reboot and battery restrictions.
- Some original routine progress and accessibility preferences remain outside the encrypted suite vault.
- Do not assume notes/drawings/recordings persist securely until their actual storage path is tested end-to-end.
- Android release candidates, Windows MSI and iOS archive previously built in CI, but those results do not establish signed production readiness or successful real-device installation.
- No independent security/privacy review has been completed.

## Batch completion log

| Batch | Scope | Status | Evidence |
| --- | --- | --- | --- |
| Baseline repair | Regression test fix and platform workflows on feature branch | Green in CI | Run 39104320840; Android 39104316262; Windows 39104318588; iOS 39104320854 |
| Next | Automated acceptance coverage for encryption, account API and storage boundaries | Not tested | Add tests and rerun CI |
| Next | Close plaintext persistence gaps and attachment lifecycle | Not tested | Tests plus migration/recovery review |
| Next | Account/API authorization and deployed sync acceptance | Not tested | Two-account/two-device test evidence |
| Next | Reminder and accessibility physical-device acceptance | Not tested | Device-specific checklist |
| Final | Signed platform releases and installer validation | Not tested | Signature and install evidence |

## Completion commitment

Continue through all workstreams, recording evidence for each gate. If a required external dependency is missing (hosting, email sender, platform signing certificates, physical devices, or independent reviewer), implement and test everything possible in the repository, mark the dependency clearly, and do not label the release complete until it is resolved.
