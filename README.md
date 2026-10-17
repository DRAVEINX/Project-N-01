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
The current deliverable is a responsive web prototype with a web app manifest and service-worker caching for offline use after the first successful visit when served over HTTPS or localhost. Users can opt in to an encrypted local vault for custom routine templates: they set a passphrase, unlock the vault after reload, and routine changes are written to an AES-256-GCM encrypted envelope. The vault auto-locks after five minutes without activity and when the page is hidden or left. Existing plaintext routine data is deliberately preserved during migration; users must unlock and check the vault, download the encrypted envelope, then separately choose to remove the old plaintext copy. Daily checklist and built-in routine progress are stored unencrypted in browser local storage for the current local date and reset automatically the next day; the settings cleanup control removes this progress. Accessibility preferences also remain unencrypted in browser local storage. Plaintext exports remain possible and are labelled as such. Notes and drawings are temporary and not saved. Do not store sensitive journal, mood, voice, or caregiver data in this prototype. CI status and manual keyboard/screen-reader/offline checks still need verification. This is not yet a native Android or Windows release and is not production-ready.

## Run locally
Requires Node.js 20 or newer.

```bash
npm test
npm run serve
```

Then open http://localhost:4173. The serve script uses Node's built-in modules and has no runtime dependencies.

## Planned milestones
1. Accessible prototype and automated smoke tests.
2. Validate flows with users and accessibility checks.
3. Add native Android phone/tablet application shell and platform-specific layouts.
4. Add secure local persistence, export/recovery, and privacy controls.
5. Build and verify Windows packaging and platform release workflows.
6. Choose final product name only after availability research.

## Project boundaries
This repository is separate from MoodPress, KlaarKompas, and CreatorNexus. Do not copy over or modify those projects as part of this work.


**Local data controls:** Settings provides a confirmation-gated way to clear the app's local routine data, accessibility preferences and encrypted vault. This does not clear browser caches, exported files, or data outside this app.


**Encrypted routine storage:** `src/secure-storage.js` and `src/encrypted-vault.js` provide PBKDF2-SHA-256/AES-256-GCM encryption and an in-memory derived-key session. The optional vault is connected to custom routine create/delete/import persistence. The passphrase and derived key are not written to storage; the in-memory session is dropped on lock. Accessibility preferences remain unencrypted, and there is no recovery flow or independent security review. See [`docs/DATA-PROTECTION.md`](docs/DATA-PROTECTION.md) before treating this as suitable for sensitive data.


**Routine migration:** `src/routine-migration.js` validates and copies existing routines into the vault without deleting the plaintext source. The UI supports vault setup/unlock, lock, encrypted downloads and a separate confirmation-gated plaintext cleanup action. Five-minute inactivity auto-lock and lock-on-hidden/pagehide are implemented; passphrase recovery and real-device verification remain open.
