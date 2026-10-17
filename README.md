# Mivoryntra

**Working product name:** Mivoryntra. The name is provisional until official trademark, app-store, business-register and domain checks are complete.

Mivoryntra is an accessibility-first daily-life companion prototype for Android phones, Android tablets and Windows. It is designed around a calm interface, clear next steps, Dutch and English language support, and user-controlled storage.

## What is implemented in this prototype

- A daily overview, step-by-step routines, custom routine templates and local daily progress.
- Calm/breathing activities and communication phrase cards with browser text-to-speech.
- A drawing pad with pointer and keyboard controls, plus explicit PNG export.
- Optional browser speech-to-text and temporary voice recording. Recording can be played back or downloaded by explicit action; audio is not uploaded or saved by this application.
- An optional encrypted local vault for custom routines and explicitly saved personal features, with a separate routines-only backup and full-vault backup/restore flow.
- Explicitly saved journal entries and drawings; a weekly appointment planner with add/edit/complete/delete actions and a 30-minute same-day duplicate warning; mood check-ins; and trusted contacts. A separate “Who is working today?” roster lets you schedule names and photos by date, browse previous/next weeks, and edit or remove each entry. Staff photos are stored once and reused across days in the encrypted vault.
- A bilingual launch/splash screen with a first-run introduction, skip controls and reduced-motion support.
- Install metadata, an offline app shell and an offline fallback page.

## Privacy and current limitations

This is still a **prototype**, not a production-ready or independently security-reviewed personal-data product.

Personal journal entries, saved drawings, mood check-ins, appointments, trusted contacts and the dated staff roster (including reusable staff photos) are stored only through the opt-in local encrypted vault. The vault uses Web Crypto (PBKDF2-SHA-256 and AES-GCM); the passphrase and derived key are not saved by the application. There is no account system, backend or cloud sync. If the vault is locked, these personal features stay hidden until it is unlocked again. Saves are limited to 900,000 bytes before encryption, leaving headroom beneath the vault helper's 1 MB limit so the app can reject oversized changes without replacing the prior saved data. The settings flow can download an encrypted backup of the entire vault and restore it only after an explicit confirmation and structural validation. Keep the passphrase safe and maintain a backup; there is no passphrase-recovery service.

Daily checklist progress and accessibility preferences are still stored unencrypted in browser local storage. Existing custom routines may also have a legacy unencrypted copy until the user separately verifies and removes it. Speech-to-text may be processed by the browser or its provider. Do not rely on the prototype for emergency communications or store highly sensitive information until the security review, device testing and recovery design are complete.

## Run locally

Requires Node.js 22 or newer.

```bash
npm test
npm run serve
```

Then open http://localhost:4173.

## Next release milestones

1. Confirm the CI workflow and test the new secure storage, full-vault backup and restore flows end to end.
2. Manually test keyboard navigation, screen readers, reduced-motion settings and offline behaviour.
3. Complete formal name checks with BOIP/EUIPO/TMview, app stores and domain registrars.
4. Complete privacy/security review, recovery and migration design.
5. Validate Android phone/tablet layouts and TalkBack, then implement and test native packaging and signed releases.
6. Validate Windows desktop layout, installer, update and uninstall flows.

A green workflow is necessary but not sufficient: features still need real-device, accessibility and privacy checks before a release can be called complete.

## Project boundaries

This repository remains separate from MoodPress, KlaarKompas, CreatorNexus and Fluxivora Studio.
