# Project N-01

An independent, accessibility-first daily-life companion for Android phones, Android tablets, and Windows. This is a temporary project codename; the public product name will be selected after trademark, app-store, and domain checks.

## Principles
- Calm, predictable interfaces with adjustable density and text size.
- Dutch and English from the start.
- Core daily-planning and self-support features intended to remain free.
- Privacy by default: personal notes and feelings are not shared automatically.
- Accessibility: keyboard support, semantic controls, reduced-motion support, and screen-reader-friendly labels.
- No medical claims; the app supports daily routines and communication and is not a replacement for professional care.

## Current stage
The repository contains a responsive web prototype and a new Daily Life Suite module accessible from “Mijn leven / My life”. The suite provides calendar day/week/month views, appointment create/edit/delete with same-start duplicate blocking and overlap confirmation, support-worker names/photos and dated shifts, mood check-ins, saved journal entries, saved drawings, step-by-step guides with a photo and audio attachment, trusted contact actions, local profiles and consent records, reminder controls, search, encrypted backup/restore and data deletion. The suite stores its own records inside a passphrase-protected AES-256-GCM encrypted local envelope and locks after five minutes of inactivity or when the page is hidden. Existing routine storage and daily checklist data remain separate: daily checklist progress and accessibility preferences in the original app are still unencrypted. The old notes view remains temporary; the new suite has its own encrypted journal and drawing store. This is still a browser/Capacitor web-content prototype, not a production-ready product or a verified native Windows/iOS release. Browser reminders only run while the suite is open and unlocked. Secure cross-device identity, real remote invitations, background scheduled notifications, Android-native key storage and independent security/accessibility review remain open work; local profiles/consent records are not a substitute for authenticated separate accounts.

## Run locally
Requires Node.js 22 or newer.

```bash
npm test
npm run serve
```

Then open http://localhost:4173. The serve script uses Node's built-in modules and has no runtime dependencies.

## Current feature implementation
- The new Daily Life Suite is integrated as a separate view, preserving the original home, routines, calm, communication, notes and settings views.
- Suite records use a local encrypted vault. The user must create and remember a passphrase of at least 12 characters; the project does not have a recovery backdoor.
- Agenda/roster, mood/journal/drawings, guides, contacts, local consent, reminders, search, and encrypted import/export now have a first implementation. See [feature status and limitations](docs/FEATURES-AND-LIMITATIONS.md).
- Automated checks cover the module's wiring and privacy-sensitive storage rules. A green CI run is still required after the latest change, followed by real-device and accessibility testing.

## Current professional expansion branch
The branch feat/professional-complete-suite adds the account API foundation, revisioned encrypted sync, optional TOTP, password-reset webhook flow, new encrypted workspace records (goals, emergency plan, documents, handovers, absence notes, reports and version snapshots), all-day appointments, travel time, recurrence date exceptions, drag/drop rescheduling, calendar history and a Capacitor local-notification bridge.

These are implementation milestones, not yet a production-ready release. Current blockers/verification tasks:
1. Configure and deploy the API with HTTPS, persistent production database, secret manager and email delivery webhook; see docs/ACCOUNT-SYNC-SETUP.md.
2. Complete CI and Android/iOS build checks and physically test notifications, reboot behavior, permissions, accessibility and installation.
3. Implement shared-vault key exchange and server-enforced per-scope access before promising remote caregiver/parent/guardian data sharing.
4. Migrate API JSON-file storage to a transactional database, native key/token storage, production rate limits and monitoring.
5. Complete independent security, privacy and accessibility review before storing real sensitive data.

## Project boundaries
This repository is separate from MoodPress, KlaarKompas, and CreatorNexus. Do not copy over or modify those projects as part of this work.


**Local data controls:** Settings provides a confirmation-gated way to clear the app's local routine data, accessibility preferences and encrypted vault. This does not clear browser caches, exported files, or data outside this app.


**Encrypted routine storage:** `src/secure-storage.js` and `src/encrypted-vault.js` provide PBKDF2-SHA-256/AES-256-GCM encryption and an in-memory derived-key session. The optional vault is connected to custom routine create/delete/import persistence. The passphrase and derived key are not written to storage; the in-memory session is dropped on lock. Daily progress and added accessibility preferences are migrated into the vault after the user unlocks it; legacy keys may remain if the vault is never unlocked or migration fails. Native platform key storage has not been integrated. The suite offers a separate encrypted recovery-file/code workflow, but there is no password reset or account recovery service and no independent security review. See [`docs/DATA-PROTECTION.md`](docs/DATA-PROTECTION.md) before treating this as suitable for sensitive data.


**Routine migration:** `src/routine-migration.js` validates and copies existing routines into the vault without deleting the plaintext source. The UI supports vault setup/unlock, lock, encrypted downloads and a separate confirmation-gated plaintext cleanup action. Five-minute inactivity auto-lock and lock-on-hidden are implemented; recovery requires keeping both the downloaded encrypted recovery file and its separate recovery code. Password reset, real-device verification and independent security review remain open.


## Platform build workflows
- Android phone and tablet builds are produced as separate installable app flavors, with different package IDs and labels; the responsive tablet layout uses the wider workspace. Debug APKs and release APK/AAB candidates: [Android build](.github/workflows/android.yml).
- Windows MSI: [Windows workflow](.github/workflows/windows.yml). The generated MSI is an unsigned test installer unless a signing certificate is configured separately.
- iOS: [iOS archive workflow](.github/workflows/ios.yml). It produces an unsigned Xcode archive, not a signed IPA and not an App Store release.

These workflows still need to complete successfully for the current source revision, and generated packages must be installed and tested on real devices. A successful build is not the same as a production-ready, signed release.


## Account API and sync deployment
See [Account API & encrypted sync setup](docs/ACCOUNT-SYNC-SETUP.md) for local startup, environment variables, webhooks, CORS/HTTPS, revision conflicts and production limitations. The current API runs as a separate service and uses a single-instance JSON-file database intended only for development. Invite roles/scopes are metadata only until shared-encryption key exchange and access enforcement are complete.

## Native reminders
The mobile build bundles Capacitor Local Notifications, requests OS permission, schedules a rolling set of reminders and supports quiet hours/private notification previews. Android exact alarms require OS permission in relevant Android versions and are still subject to power-management delays. Test delivery on physical devices before relying on reminders.
