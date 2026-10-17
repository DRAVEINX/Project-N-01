# Project N-01 roadmap

## Phase 1 — Prototype foundation
- [x] Responsive bilingual interface skeleton
- [x] Daily task check-off
- [x] Routine cards
- [x] Calm/breathing interaction
- [x] Communication phrase cards and browser text-to-speech support
- [x] Text size, quiet view and reduced-motion controls
- [x] Bilingual drawing pad in the notes view, with pointer and keyboard input; drawings are temporary and not stored
- [x] Routine completion buttons expose their state to assistive technology and update in the selected language
- [x] Routines support step-by-step checklists with live progress and one-tap complete/reset
- [x] Users can create and delete their own routines with up to 10 steps; browser-only storage is disclosed as unencrypted
- [x] Custom routine templates can be exported/imported as JSON with file-size and item-count limits; exports are disclosed as unencrypted
- [x] Users can clear all custom routine templates after a confirmation; storage failures are reported
- [x] Basic CI smoke tests
- [ ] Verify GitHub Actions result and fix any failures (not confirmed from this session)
- [ ] Manual keyboard, screen-reader and mobile/tablet viewport review

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
- [ ] Data model and local-first storage strategy
- [ ] Backup/export and deletion design
- [ ] Threat model and privacy review

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
