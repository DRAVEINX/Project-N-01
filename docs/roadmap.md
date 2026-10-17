# Project N-01 roadmap

## Phase 1 — Prototype foundation
- [x] Responsive bilingual interface skeleton
- [x] Daily task check-off
- [x] Routine cards
- [x] Calm/breathing interaction
- [x] Communication phrase cards and browser text-to-speech support
- [x] Text size, quiet view and reduced-motion controls
- [x] Basic CI smoke tests
- [ ] Verify GitHub Actions result and fix any failures
- [ ] Manual keyboard and mobile viewport review

## Phase 2 — Make the prototype more robust
- [x] Web app manifest and install metadata
- [x] Service worker for caching prototype assets after first visit
- [x] Offline fallback page
- [ ] Add automated checks for manifest and service worker behavior
- [ ] Add durable settings persistence only after privacy implications are documented
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
