# Mivoryntra

**Working product name:** Mivoryntra. The name is provisional until official trademark, app-store, business-register and domain checks are complete.

Mivoryntra is an accessibility-first daily-life companion prototype for Android phones, Android tablets and Windows. It is designed around a calm interface, clear next steps, Dutch and English language support, and user-controlled storage.

## What is implemented in this prototype

- A daily overview, step-by-step routines, custom routine templates and local daily progress.
- Calm/breathing activities and communication phrase cards with browser text-to-speech.
- A drawing pad with pointer and keyboard controls, plus explicit PNG export.
- Optional browser speech-to-text and temporary voice recording. Recording can be played back or downloaded by explicit action; audio is not uploaded or saved by this application.
- An optional encrypted local vault for custom routines and new personal features.
- Explicitly saved journal entries and drawings, a weekly appointment planner, mood check-ins, and a trusted-people list. These features write personal content only after a user action and only when the encrypted vault is unlocked.
- A bilingual launch/splash screen with a first-run introduction, skip controls and reduced-motion support.
- Install metadata, an offline app shell and an offline fallback page.

## Privacy and current limitations

This is still a **prototype**, not a production-ready or independently security-reviewed personal-data product.

Personal journal entries, saved drawings, mood check-ins, appointments and trusted contacts are stored only through the opt-in local encrypted vault. The vault uses Web Crypto (PBKDF2-SHA-256 and AES-GCM); the passphrase and derived key are not saved by the application. There is no account system, backend or cloud sync. If the vault is locked, these personal features stay hidden until it is unlocked again. Keep the passphrase safe and maintain an encrypted backup; there is no passphrase-recovery service.

Daily checklist progress and accessibility preferences are still stored unencrypted in browser local storage. Existing custom routines may also have a legacy unencrypted copy until the user separately verifies and removes it. Speech-to-text may be processed by the browser or its provider. Do not rely on the prototype for emergency communications or store highly sensitive information until the security review, device testing and recovery design are complete.

## Run locally

Requires Node.js 22 or newer.

```bash
npm test
npm run serve
```

Then open http://localhost:4173.

## Next release milestones

1. Confirm the CI workflow and test the new secure storage flows end to end.
2. Manually test keyboard navigation, screen readers, reduced-motion settings and offline behaviour.
3. Complete formal name checks with BOIP/EUIPO/TMview, app stores and domain registrars.
4. Complete privacy/security review, recovery and migration design.
5. Validate Android phone/tablet layouts and TalkBack, then implement and test native packaging and signed releases.
6. Validate Windows desktop layout, installer, update and uninstall flows.

A green workflow is necessary but not sufficient: features still need real-device, accessibility and privacy checks before a release can be called complete.

## Project boundaries

This repository remains separate from MoodPress, KlaarKompas, CreatorNexus and Fluxivora Studio.
