# NovaLife

An independent, accessibility-first daily-life companion for Android phones, Android tablets, and Windows. NovaLife is the selected provisional public product name. Complete trademark, app-store, and domain checks before public release. The repository name and technical identifiers remain unchanged during this safe display-name rebrand.

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

## Remaining milestones
1. Run CI and fix every failing test; validate phone/tablet layout manually.
2. Add authenticated accounts and a secure server-side invitation/consent flow before claiming remote caregiver access.
3. Implement native background reminders and platform key storage where appropriate.
4. Implement authenticated cross-device sync with conflict review, then test Android phone/tablet, Windows packaging and any iOS target separately.
5. Complete independent security, privacy and accessibility reviews before storing real sensitive data.

## Project boundaries
This repository is separate from MoodPress, KlaarKompas, and CreatorNexus. Do not copy over or modify those projects as part of this work.


**Local data controls:** Settings provides a confirmation-gated way to clear the app's local routine data, accessibility preferences and encrypted vault. This does not clear browser caches, exported files, or data outside this app.


**Encrypted routine storage:** `src/secure-storage.js` and `src/encrypted-vault.js` provide PBKDF2-SHA-256/AES-256-GCM encryption and an in-memory derived-key session. The optional vault is connected to custom routine create/delete/import persistence. The passphrase and derived key are not written to storage; the in-memory session is dropped on lock. The original app’s daily progress and accessibility preferences remain unencrypted. The suite offers a separate encrypted recovery-file/code workflow, but there is no password reset or account recovery service and no independent security review. See [`docs/DATA-PROTECTION.md`](docs/DATA-PROTECTION.md) before treating this as suitable for sensitive data.


**Routine migration:** `src/routine-migration.js` validates and copies existing routines into the vault without deleting the plaintext source. The UI supports vault setup/unlock, lock, encrypted downloads and a separate confirmation-gated plaintext cleanup action. Five-minute inactivity auto-lock and lock-on-hidden are implemented; recovery requires keeping both the downloaded encrypted recovery file and its separate recovery code. Password reset, real-device verification and independent security review remain open.


## Platform build workflows
- Android phone and tablet builds are produced as separate installable app flavors, with different package IDs and labels; the responsive tablet layout uses the wider workspace. Debug APKs and release APK/AAB candidates: [Android build](.github/workflows/android.yml).
- Windows MSI: [Windows workflow](.github/workflows/windows.yml). The generated MSI is an unsigned test installer unless a signing certificate is configured separately.
- iOS: [iOS archive workflow](.github/workflows/ios.yml). It produces an unsigned Xcode archive, not a signed IPA and not an App Store release.

These workflows still need to complete successfully for the current source revision, and generated packages must be installed and tested on real devices. A successful build is not the same as a production-ready, signed release.


## Priority 1: accounts and secure cloud sync

A new `server/` directory contains the PostgreSQL schema, account API, email-verification/password-reset routes, optional authenticator TOTP, household roles/consent records, and versioned storage for the opaque client-encrypted vault. See [server setup and limitations](server/README.md). This is source code only until it is deployed with a real PostgreSQL database, HTTPS and verified email sender.

The `Account & apparaten` view provides account registration/login, account recovery, MFA setup, manual encrypted vault sync, conflict/version review, household invitations, consent records and a local-data inventory. The server is configured from the UI only by its HTTPS base URL; secrets belong in hosting environment variables. Category consent is tracked, but per-category end-to-end sharing is not enabled until the content encryption/sharing protocol has received a separate design review.

Android/iOS builds now bundle the Capacitor local-notifications plugin for on-device scheduled reminders, where a permission is granted. Real devices must be tested for reboot behavior, time-zone/DST rules and OEM battery restrictions. Generic notification text is used by default so sensitive appointment titles are not displayed on a lock screen.

The app also supports encrypted local version history and a local summary/calendar-export bridge when the personal vault is unlocked. The core daily progress and accessibility preferences still use the pre-existing local storage model; full at-rest protection for those fields and platform-native keystore integration remain explicit release blockers until migrated, tested and independently reviewed. Do not use the app for sensitive real-world records until hosting, security, privacy and usability acceptance checks have passed.
