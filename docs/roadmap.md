# Mivoryntra roadmap (working name)

## Phase 1 — Prototype foundation
- [x] Responsive bilingual interface skeleton
- [x] Daily task check-off
- [x] Routine cards
- [x] Calm/breathing interaction
- [x] Communication phrase cards and browser text-to-speech support
- [x] Text size, quiet view and reduced-motion controls
- [x] Bilingual drawing pad in the notes view, with pointer and keyboard input; drawings remain temporary unless the user explicitly saves them in the encrypted vault or exports a PNG
- [x] Export drawings as PNG on explicit user action, with Dutch/English status messages; drawings remain in memory until exported and are not stored by the app
- [x] Add opt-in voice recording with in-page playback and explicit audio download; recordings remain in memory and are not persisted or uploaded by the app
- [x] Add optional Dutch/English browser speech-to-text that appends final recognized text to the notes field, with unsupported/error states and a warning that recognition may be processed by a browser/provider service
- [x] Add explicit text-file export for notes and a live character count; note content is not automatically persisted
- [x] Routine completion buttons expose their state to assistive technology and update in the selected language
- [x] Routines support step-by-step checklists with live progress and one-tap complete/reset
- [x] Users can create and delete their own routines with up to 10 steps; browser-only storage is disclosed as unencrypted
- [x] Custom routine templates can be exported/imported as JSON with file-size and item-count limits; exports are disclosed as unencrypted
- [x] Users can clear all custom routine templates after a confirmation; storage failures are reported
- [x] Basic CI smoke tests
- [ ] Verify GitHub Actions result and fix any failures (not confirmed from this session)
- [ ] Manual keyboard, screen-reader and mobile/tablet viewport review

## Current feature branch — Mivoryntra intro and private tools

- [x] Add a bilingual, skippable first-run intro and short returning-launch splash.
- [x] Add the working Mivoryntra name to the prototype shell and install metadata; name clearance is still pending.
- [x] Add an encrypted-vault gate for explicit journal entry saves and saved drawings.
- [x] Add an encrypted local week planner, mood check-ins and trusted-person contacts.
- [x] Preserve the additional encrypted fields when existing custom routines are edited.
- [x] Add a separate full-vault restore action, with confirmation, 2 MiB file limit, schema/collection validation before overwrite, and localized status messages.
- [x] Add regression tests for valid full-vault data and rejection of invalid mood values, dates, photo formats, collection limits and oversized payloads.
- [x] Add date/time duplicate prevention to the week planner: same-date appointments within 30 minutes are rejected, and identical titles are checked when an appointment has no time; editing excludes the appointment itself.
- [x] Add an editable “Who is working today?” roster with previous/next week navigation, date-specific assignments, name, role, notes and photo.
- [x] Store each staff photo once in the encrypted staff directory and reference the profile from daily assignments; edits and deletion update the current assignment and remove unused profiles.
- [x] Prevent the same normalized staff name from being scheduled twice on the same date; permit the same staff member on different dates.
- [x] Add phone/tablet responsive styling, lock-time roster DOM cleanup, full-vault validation and regression tests for the agenda and staff roster.
- [x] Add edit/cancel flows for appointments and trusted contacts; preserve appointment identity and keep a contact photo unless the user chooses a replacement.
- [x] Add regression tests that check editing updates the existing encrypted record rather than creating duplicates.
- [ ] Confirm the latest GitHub Actions CI run for the newest source commit.
- [ ] Manually exercise add/edit/cancel/delete/lock/unlock and full-vault backup/restore on Android phone/tablet, including screen readers, reduced motion and offline start.
- [ ] Complete official trademark, app-store and domain checks before making the name public.

## Phase 2 — Make the prototype more robust
- [x] Web app manifest and install metadata
- [x] Service worker for caching prototype assets after first visit
- [x] Offline fallback page
- [x] Add static smoke checks for manifest metadata and service-worker safeguards (runtime offline behavior still needs manual verification)
- [x] Persist only language/accessibility preferences in browser local storage; disclose this in the UI (not encrypted and not suitable for sensitive notes)
- [ ] User testing with a range of accessibility needs

## Phase 3 — Product foundation
- [ ] Final brand/name research across app stores, BOIP/EUIPO/TMview and domain availability
- [ ] Architecture decision for native Android and Windows implementations
- [x] Prototype privacy panel explains unencrypted browser storage and offers confirmed deletion of routines/preferences
- [ ] Data model and local-first storage strategy
- [ ] Backup/export and deletion design
- [x] Draft data-protection threat model and encryption integration checklist (`docs/DATA-PROTECTION.md`); review still required
- [x] Web Crypto AES-GCM/PBKDF2 helper with an in-memory derived-key session for the optional routine vault
- [x] Encrypted routine backup export/restore with passphrase prompt, input validation and a 1 MiB import limit; imports write to the active routine store
- [x] Encryption helper rejects non-JSON values and oversized payloads with regression tests
- [ ] Security expert review and threat-model sign-off
- [x] Add encrypted vault adapter with an in-memory key session, authenticated unlock, encrypted saves, lock and restore tests
- [x] Add non-destructive legacy routine preview/copy helper with validation and tests; original plaintext remains untouched
- [x] Add explicit UI setup/unlock, lock, encrypted routine persistence and encrypted vault download
- [x] Connect custom-routine create/edit/delete/import persistence to the opt-in encrypted vault; passphrase is required again after reload
- [x] Add five-minute inactivity auto-lock and lock on hidden/pagehide events for the encrypted routine vault
- [ ] Move accessibility preferences to an appropriate protected storage design if needed, design recovery, and validate rollback/migration on real devices

## Phase 4 — Android phone and tablet
- [ ] Separate phone and tablet layout validation
- [ ] Android accessibility checks and TalkBack testing
- [ ] Offline-first data and recovery
- [ ] Unit and UI tests
- [ ] Signed APK/AAB artifacts from verified CI builds

## Phase 5 — Windows
- [ ] Keyboard-first desktop UI
- [ ] High-DPI and resize testing
- [ ] Installer, upgrade and uninstall validation
- [ ] Signed installer where feasible

## Definition of done
A green workflow is necessary but not sufficient. Each feature must be exercised, accessibility reviewed, and platform-specific release artifacts tested before being described as complete.
