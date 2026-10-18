# Project N-01 — acceptance checklist for the next release

This checklist is for the separate `feature/professional-suite-priority-1` work branch. It does not authorize merging into `main` or changing other DRAVEINX projects.

## Gate 1 — automated checks

- [ ] Run `npm test` on Node.js 22+ and fix every failure.
- [ ] Check browser scripts for syntax errors, missing element IDs, and uncaught promise rejections.
- [ ] Check Dutch and English labels for every newly exposed control.
- [ ] Verify empty states, validation errors, and success/error status messages are announced to screen readers.
- [ ] Ensure tests do not require real account credentials, a production database, or live email delivery.

## Gate 2 — daily-life suite

- [ ] Agenda: create, edit, delete and reload an appointment; reject an exact same-start duplicate; offer confirmation for a partial overlap; verify date boundaries and weekly repeats.
- [ ] Calendar export: export a selected date range; validate the generated file and confirm that private notes are not included unless explicitly selected.
- [ ] Support roster: add/edit/remove a worker, name and photo; assign dated shifts; confirm the day and week views update and persist after reload.
- [ ] Goals and plans: create, edit, complete and delete a goal; verify progress remains correct after reload and after import/restore.
- [ ] Documents and guides: attach supported file/photo/audio formats; validate size/type limits; verify removal and backup/restore behavior.
- [ ] Journal, mood and drawings: verify create/read/update/delete, keyboard access, audio permissions and vault lock behavior.
- [ ] Reminders: schedule, edit, cancel and snooze; check permission denial, time-zone changes, daylight-saving transitions and reboot behavior on physical Android devices.

## Gate 3 — account and sync safety

- [ ] Account routes require verified email and return generic responses for unknown accounts.
- [ ] Test invalid/expired/used password-reset tokens, wrong TOTP, logout and revoked sessions.
- [ ] Sync accepts only the documented encrypted envelope; reject malformed payloads and invalid versions.
- [ ] Simulate two devices saving from the same base version; a conflict must be surfaced for review and must never silently overwrite data.
- [ ] Verify household roles and consent revocation; do not expose one user's vault to another household member.
- [ ] Confirm secrets are supplied only through deployment environment variables, never committed to Git or embedded in client bundles.

## Gate 4 — platform builds and manual acceptance

- [ ] Android phone debug APK installs, launches, survives rotation and keeps its own app identity/data.
- [ ] Android tablet debug APK installs and uses the wide layout without a phone-sized centered panel.
- [ ] Test TalkBack, large text, contrast, keyboard focus and touch-target sizes on both form factors.
- [ ] Verify Windows installer launches from both the desktop and Start menu and uninstalls cleanly.
- [ ] Treat unsigned APK/AAB/MSI/Xcode archive outputs as test artifacts, not production releases.
- [ ] Do not call iOS a signed release until signing and device installation are confirmed.

## Release blockers

- [ ] Deploy and harden the API with HTTPS, database backups, email sender verification, monitoring and rate limiting suitable for the hosting topology.
- [ ] Migrate remaining plaintext routine progress and accessibility preferences or document an explicit safe migration before real sensitive data is used.
- [ ] Complete independent security, privacy and accessibility review before production use.
- [ ] Test generated artifacts on physical devices; a green workflow alone does not prove installability or usability.

## Reporting rule

Record each item as **green**, **red**, or **not tested**, with the workflow run or reproducible steps. Never report an item green solely because a build succeeded.
