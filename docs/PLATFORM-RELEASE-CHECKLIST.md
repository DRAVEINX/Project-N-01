# Platform release verification checklist

This checklist separates automated build success from actual product/release verification. Use it for each release candidate and record device/OS, build SHA, tester, date, result, and any issue.

## Current CI evidence

- Source commit with four successful workflows: `d43f216642c4745b3c8e3592a8c9d4abe87472c0`.
- Regression tests: https://github.com/DRAVEINX/Project-N-01/actions/runs/39109348866
- Android build: https://github.com/DRAVEINX/Project-N-01/actions/runs/39109348863
- Windows MSI: https://github.com/DRAVEINX/Project-N-01/actions/runs/39109348849
- iOS archive: https://github.com/DRAVEINX/Project-N-01/actions/runs/39109348935

These are CI build results only. They do not confirm that an app has been installed and exercised on physical devices.

## Android phone and tablet

Artifacts are uploaded by the Android workflow as `project-n-01-phone-release-candidate` and `project-n-01-tablet-release-candidate`. Each contains the relevant release APK and AAB when the build succeeds. Release signing is optional in the workflow, so verify signatures before distribution.

- [ ] Download both artifact bundles from the exact successful run and retain the source SHA.
- [ ] Confirm APK and AAB files exist for both phone and tablet; verify package IDs differ as expected.
- [ ] Verify signing status and certificate fingerprint; do not distribute an unsigned candidate as a signed release.
- [ ] Install phone APK on a physical phone; launch from app icon and app switcher.
- [ ] Install tablet APK on a physical tablet; confirm layout fills the screen and is not a narrow, centered phone layout.
- [ ] Exercise main navigation, create/edit/delete, reload, lock/unlock, backup/restore and wrong-passphrase handling.
- [ ] Test TalkBack, large text, keyboard/focus order where applicable, contrast, reduced motion, and clipped text.
- [ ] Test offline startup and recovery after force-close/restart.
- [ ] Check microphone permission and voice recording only if that feature is being tested; confirm permission denial is handled clearly.
- [ ] Record device model, Android version, app variant, build SHA, pass/fail, and screenshots/logs for failures.

## Windows

The workflow currently uploads `project-n-01-windows-msi-unsigned`; it is explicitly an unsigned installer candidate.

- [ ] Download MSI from the exact successful workflow run.
- [ ] Install on a clean Windows 11 test environment and launch from both Start menu and desktop shortcut if present.
- [ ] Confirm the main window opens, can be resized/maximized, and closes from the window close button.
- [ ] Test keyboard-only navigation, high-DPI scaling, restart, upgrade over prior version, and uninstall.
- [ ] Verify installer signature before distribution; document unsigned status if no signing certificate is configured.
- [ ] Confirm uninstall behavior and data retention/deletion messaging are correct.

## iOS

The workflow currently creates `project-n-01-ios-unsigned-archive`. It is an unsigned Xcode archive, not a signed installable release or TestFlight build.

- [ ] Download the archive from the exact successful workflow run.
- [ ] Configure Apple signing/provisioning in an authorized macOS/Xcode environment.
- [ ] Create a signed archive and validate installation on a physical iPhone.
- [ ] Test navigation, safe areas, keyboard behavior, accessibility, offline startup, permissions and data recovery.
- [ ] Do not describe the unsigned CI archive as an iPhone release ready to install or distribute.

## Security and privacy gate

- [ ] Complete an independent review of the threat model and encryption implementation.
- [ ] Decide how native platform storage (Android Keystore / Windows DPAPI or CNG / iOS Keychain) is used, rather than assuming browser encryption covers native storage.
- [ ] Verify which modules store plaintext; accessibility preferences and some routine/progress values remain outside the encrypted vault.
- [ ] Validate migration, backup restoration, data deletion and recovery on test data.
- [ ] Verify that caregiver/guardian profiles and consent are not treated as secure multi-user authorization until the server-side identity/permission model is implemented and reviewed.
- [ ] Never use real sensitive mood, journal, voice or care data for acceptance testing before these gates are cleared.

## Sign-off record

- Release/version:
- Source commit SHA:
- CI run links:
- Device/OS matrix:
- Accessibility tester and results:
- Security/privacy reviewer and result:
- Known issues:
- Final decision: `NOT REVIEWED` / `PASS WITH LIMITATIONS` / `BLOCKED`
