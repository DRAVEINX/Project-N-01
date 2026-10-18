# Project N-01

An independent, accessibility-first daily-life companion for Android phones, Android tablets, and Windows. This remains a temporary project codename; choose the public product name after trademark, app-store and domain checks.

## Principles
- Calm, predictable interfaces with adjustable density and text size.
- Dutch and English from the start.
- Core daily-planning and self-support features intended to remain free.
- Privacy by default: personal notes and feelings are not shared automatically.
- Accessibility: keyboard support, semantic controls, reduced-motion support and screen-reader-friendly labels.
- No medical claims; the app supports daily routines and communication and is not a replacement for professional care.

## Current stage

The repository contains the original responsive prototype and the Daily Life Suite, plus a separate account/synchronization workspace on the feature branch. New local tools include an emergency plan, goals and progress, small document attachments in the encrypted local vault, absence and handover notes for support workers, opt-in downloadable weekly reports, local restore checkpoints, appointment change history, all-day appointments, travel time, simple mode, speech output/recognition and native notification scheduling.

The feature branch also adds optional Supabase Auth sign-up/login/password recovery, TOTP screens, expiring caregiver invitation metadata and encrypted whole-vault snapshot uploads. These require a user-owned Supabase project and the SQL migration in supabase/migrations before they can run. This is not yet production-ready: snapshot sync is not per-record realtime merging, and an invited caregiver is not yet given the ability to decrypt/share the owner's personal vault. Email delivery and real account setup have not been configured here.

The Life Suite records are stored in a passphrase-protected AES-256-GCM encrypted envelope with an automatic five-minute lock. Important limitation: legacy routine completion/progress and global accessibility preferences remain in separate, unencrypted browser storage until their migration is completed and tested. Native reminder scheduling still requires real-device testing for permissions, app close/reboot, daylight-saving and time-zone behavior. A signed Windows installer or signed iOS/App Store release has not been verified; a green build alone is not production readiness.

## Run locally

Requires Node.js 22 or newer.

```bash
npm install
npm test
npm run serve
```

Then open http://localhost:4173.

## Feature and rollout documentation
- Feature status and limitations: docs/FEATURES-AND-LIMITATIONS.md
- Data protection: docs/DATA-PROTECTION.md
- Platform setup (Supabase, encrypted snapshots, native reminders): docs/PLATFORM-ENHANCEMENTS.md

## Remaining milestones
1. Pass CI on the feature pull request, then validate on actual Android phone/tablet and Windows hardware/installations.
2. Configure the target Supabase project, email/SMTP, password-recovery redirects and test separate accounts, MFA/AAL2 and RLS policies.
3. Complete a dedicated key-sharing and per-record authorization design before claiming that caregivers can read private records.
4. Test encrypted snapshot conflict resolution, offline changes, restore and migrate the legacy completion/preferences stores into appropriate protected storage.
5. Verify native reminders after app close/reboot and through time-zone changes, and conduct independent security, privacy and accessibility reviews before production.

## Project boundaries

This repository is separate from MoodPress, KlaarKompas and CreatorNexus. Do not copy over or modify those projects as part of this work.
