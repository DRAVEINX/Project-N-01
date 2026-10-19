# NovaLife release-readiness checklist

This checklist is deliberately separate from the app runtime. It does not claim that any release is production-ready; it records what must be verified before real care or health-adjacent data is entered.

## Current implementation facts

- The Daily Life Suite stores its records in a local AES-256-GCM encrypted envelope, using a passphrase-derived key (PBKDF2-SHA-256).
- After a successful unlock, the derived key remains in memory for the current session. Switching between suite tabs should not require the passphrase again. The vault locks after five minutes of inactivity; background behavior has a grace period.
- The suite includes a self-reported mood check-in, journal, drawings, appointments, weekly planning, worker roster, care records, reminders, local profile roles, consent records and encrypted backup/restore.
- The role/profile system is local UI-level policy only. It is not secure authentication and does not protect data from someone who can modify local browser state or application code.
- The Android phone and tablet workflows create separate variants. Windows packaging produces an unsigned MSI unless signing is configured. The iOS workflow produces an unsigned archive, not a signed IPA.
- The original app's routine/checklist and accessibility-preference storage has known plaintext-storage limitations. Do not describe all app data as encrypted.

## P0 — required before production or sensitive data

- [ ] Implement authenticated user accounts and server-enforced authorization before offering separate client, caregiver, parent or guardian access.
- [ ] Ensure every record read/write/export/import is authorized on the server; local role labels and consent records alone are insufficient.
- [ ] Threat-model the vault and key lifecycle, including browser storage, app switching, backups, clipboard, logs and crash reporting.
- [ ] Review every data store for plaintext personal records and migrate legacy data without deleting originals until the user verifies the migration.
- [ ] Validate encrypted backup and recovery-code behavior, including wrong passphrase, corrupted file, duplicate IDs, interrupted restore and storage-full cases.
- [ ] Complete independent security and privacy review; document data minimization, retention, deletion, incident handling and user consent.
- [ ] Verify accessibility with TalkBack, VoiceOver, keyboard-only navigation, zoom/text scaling, contrast and reduced motion.

## P1 — functional acceptance

- [ ] Confirm a single unlock persists across every suite tab until explicit lock or timeout.
- [ ] Confirm manual lock clears the in-memory key and requires re-authentication.
- [ ] Confirm automatic lock does not lose unsaved user input silently; explain the timeout clearly.
- [ ] Test user mood reports remain available to the user and are not automatically shared without explicit permission.
- [ ] Test caregiver-only views are hidden from client navigation and reject unauthorized actions; repeat tests against server APIs after server authorization exists.
- [ ] Test consent revocation immediately removes the relevant access.
- [ ] Test week roster edits, support-worker photos, plans, handovers, reports, medication list and document metadata against the correct profile.
- [ ] Verify CSV/JSON exports contain only the selected profile's permitted data and warn users that exported files are no longer protected by the app's vault.
- [ ] Verify notification wording accurately states that browser reminders may require the app to remain open.

## P2 — platform and release acceptance

### Android phone
- [ ] CI green for the exact release commit.
- [ ] Install and launch release APK on a physical phone.
- [ ] Verify package ID, icon, orientation, keyboard, TalkBack, large text and offline behavior.
- [ ] Confirm release AAB is generated and signed with the intended release key; never commit signing secrets.

### Android tablet
- [ ] CI green for the exact release commit.
- [ ] Install and launch release APK on a physical tablet.
- [ ] Verify wide layout fills the usable workspace and does not render as a narrow centered phone screen.
- [ ] Verify package ID differs from the phone variant and confirm release AAB signing.

### Windows
- [ ] CI green for the exact release commit.
- [ ] Install MSI on a clean Windows account and launch from Start Menu and desktop shortcuts.
- [ ] Verify uninstall, reinstall, update behavior, data retention, local storage path and app logs.
- [ ] Configure and verify trusted code signing before distributing beyond test users.

### iOS
- [ ] Build on the intended macOS/Xcode version.
- [ ] Configure Apple signing/provisioning and produce a signed IPA before calling it a release.
- [ ] Test install, app lifecycle, voiceover, key handling and backup behavior on a physical iPhone.

## Release rule

A green GitHub Actions run proves only that the configured automation passed for that commit. It does not prove security, correct authorization, real-device usability, valid signing, app-store acceptance or production readiness. Keep phone, tablet, Windows and iOS results tracked separately, and do not merge this checklist as a claim that outstanding items are complete.
