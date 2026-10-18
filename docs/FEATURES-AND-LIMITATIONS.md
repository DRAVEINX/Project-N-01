# Daily Life Suite: feature status and limitations

## Implemented in the current development branch

- **Calendar:** day, week and month views; appointments can be created, edited and deleted; all-day records, travel-time field, weekly preview entries, excluded weekly dates, duplicate blocking, overlap confirmation, drag-and-drop rescheduling of individual entries and an appointment change log. The recurrence engine is still finite: a weekly template expands to up to eight entries, not an unlimited recurrence rule. Dragging the root of a weekly series is intentionally blocked; edit the series instead.
- **Support roster:** local names, roles, profile photos, dates and shift editing. The extra portal stores local absence notes and handover entries inside the vault, but it is not a shared multi-account staff portal.
- **Mood, journal and drawings:** mood check-in, journal text/audio attachments, drawing canvas, saved entries, review and deletion.
- **Step-by-step guides:** instructions with steps, photos and audio; progress per guide.
- **Trusted contacts and personal emergency plan:** contact actions require confirmation; the emergency plan can be read aloud. The app does not automatically call emergency services or confirm a message was sent.
- **Goals and activities:** add goals, percentages, due dates, next steps, completion/reopen and delete.
- **Personal documents:** local note/file attachments up to 512 KiB per document, encrypted with the personal vault, plus controlled download.
- **Weekly reports:** counts of appointments, planned tasks and mood entries for the recent week. Reports do not include journal text, audio, emergency-plan contents or contacts. The user can choose which counts to print.
- **Calendar export:** create an iCalendar (.ics) file. The downloaded file is outside the encrypted vault; check it before sharing.
- **Encrypted local records:** the Life Suite uses PBKDF2-SHA-256 and AES-256-GCM in a local envelope. Its derived key is held in memory and the vault auto-locks after five minutes and when the page becomes hidden. Extra goals, documents, preferences, reports settings, daily progress, handover notes and emergency plan are stored inside that envelope.
- **Legacy migration:** when the vault is unlocked, old daily progress and accessibility preference keys are imported into the encrypted vault and removed only after a successful save. If the vault is never created/unlocked or migration fails, old plaintext values may remain; they are not magically encrypted retroactively.
- **Accessibility:** semantic buttons/status, keyboard focus, larger text, high contrast, reduced motion, speech synthesis, optional Web Speech speech-to-text, simple mode and larger controls. Browser speech recognition can send audio to the browser vendor/service depending on platform settings.
- **Native reminder bridge:** the branch includes a Capacitor local-notifications integration for future scheduled alerts, Android notification/exact-alarm manifest permissions, quiet-hour handling, private-by-default notification text, duplicate ID handling, repeated reminders and a 10-minute snooze action. It schedules a rolling subset of the next 30 days. Permissions, operating-system background policies, reboot behavior and actual reminder delivery still require physical-device tests.
- **Accounts API foundation:** registration, scrypt password hashes, expiring bearer sessions, TOTP authenticator setup, reset-token workflow, account deletion, scoped invitation metadata and revision-based encrypted vault upload/download are implemented in server/api.mjs. The API is optional and must be deployed/configured separately; the web UI defaults to /api.
- **Cross-device sync foundation:** the API accepts only the versioned encrypted AES-GCM vault envelope and uses optimistic revision checking. Conflicts return a 409 response and are not silently overwritten. Devices with an already-populated cloud vault must manually choose how to proceed. Local offline changes stay on the device until a safe upload can be made.
- **Version history:** the last ten snapshots of the additional professional-workspace data can be restored. This does not restore the entire agenda, journal and all app records.

## Account, synchronization and sharing limits

- This API uses a local JSON database and in-process rate limits. It is a single-instance prototype, not a scalable production account service. Do not run multiple API processes against the same JSON file.
- Password reset is sent only when the deployment has a trusted delivery webhook and public app URL configured. Resetting the account password does not reset the separate local vault passphrase.
- Two-factor setup needs a private server secret of at least 32 characters. Use a secret manager rather than committing one into source code.
- Team invitations store roles/scopes and can be accepted after email delivery is configured. **Encrypted workspace content is not yet shared with invitees.** Local profiles and consent labels are not security boundaries and do not constitute real caregiver/guardian authorization.
- The API currently has no managed transactional database, KMS/key rotation, distributed rate limiter, production monitoring or independently reviewed threat model. Do not use it for real sensitive information until those gaps are assessed and resolved.
- Cross-device sync currently transfers an entire encrypted vault envelope, not individual records. There is no item-by-item device conflict merge yet. Use backups and explicit review before replacing a local vault with a cloud copy.
- Native Android Keystore and Apple's appropriate secure key storage have not been integrated into the local web vault. Web encryption protects stored records, but not a compromised device, malicious browser extension/injected script, or an unlocked app session.
- Reminder accuracy is still subject to Android/iOS permissions, power management, manufacturer battery restrictions and timezone/clock conditions. Exact alarms can require user authorization. The app never guarantees that a notification will appear on time.
- Phone/tablet layouts and iOS archive/Windows MSI builds need installation checks on real hardware. Current installers/archives from previous builds may be unsigned candidates. Green automated builds are not proof of a production-ready signed release.
- TalkBack, keyboard-only, magnification, high-contrast, privacy notice, restore/deletion flows and user experience need human testing. There has been no independent security/privacy assessment in this branch.

## Environment/setup

See [ACCOUNT-SYNC-SETUP.md](ACCOUNT-SYNC-SETUP.md) for API configuration, webhook expectations, CORS/HTTPS requirements, sync testing and production migration checklist.

## Recommended acceptance checks

1. Run npm test, syntax checks and all CI checks.
2. Install the new phone/tablet debug packages; test lock/unlock, encrypted migration, wrong passphrase, recovery, deletion, offline use and data-full failures.
3. Test all-day and timed appointment conflict behavior, exception dates, repeated series editing, drag/drop, calendar timezone/DST changes and .ics export/import.
4. Grant/deny notifications, enable/disable exact alarms, close the app, restart the device, trigger quiet hours and test snooze/repeated notifications on current Android and iOS devices.
5. Validate password reset, 2FA recovery planning, session revocation, invitation delivery and account deletion against a deployed test server.
6. Verify that no invitee can read another user's vault unless a later explicit secure sharing design is implemented and tested.
7. Complete independent security, privacy and accessibility review before any production release or real sensitive data use.
