# Architecture and platform plan

## Current implementation
The repository currently contains a dependency-free responsive web prototype. It is useful for validating content and interactions, but it is not a native Android or Windows product.

## Planned platform structure
- `apps/android-phone/`: Android phone application and phone-specific navigation/layout.
- `apps/android-tablet/`: tablet-optimized layouts with wider content regions and persistent navigation where appropriate.
- `apps/windows/`: Windows desktop shell, keyboard-first interactions, window resizing and installer packaging.
- `shared/`: locale strings, design tokens, domain models and platform-neutral validation rules where genuinely shared.
- `docs/`: architecture decisions, privacy model, test strategy and release checklist.

Do not create platform directories as empty placeholders and claim that builds work. Add a platform only when its toolchain, build configuration, tests and artifacts can be verified.

## Accessibility requirements
- All primary actions reachable by keyboard.
- Visible focus indicators and semantic labels.
- Screen-reader names for icon-only controls.
- Respect OS reduced-motion preference and provide an in-app setting.
- Text enlargement must not clip controls or force horizontal scrolling at common widths.
- Avoid relying on color alone to convey status.
- No flashing or compulsory audio.

## Privacy requirements
- Personal journal entries, drawings, mood records and voice recordings are private by default.
- Caregiver/guardian access must be explicit, limited, revocable and visible to the user where appropriate.
- Never send personal content to a server without a clear opt-in and understandable explanation.
- Before production, define encryption, data deletion, backup/recovery, threat model and retention rules.
- The current prototype does not persist notes or personal records.

## Release gates
1. Automated tests pass on a clean checkout.
2. Accessibility review covers keyboard, screen reader, text scaling, contrast and reduced motion.
3. Offline behavior and error states are tested.
4. Privacy and deletion flows are reviewed.
5. Phone and tablet layouts are checked separately.
6. Windows package is installed, launched, upgraded and uninstalled in a clean test environment.
7. Build artifacts and checksums are attached to a release only after successful builds.
