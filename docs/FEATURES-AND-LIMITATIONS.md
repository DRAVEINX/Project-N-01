# Daily Life Suite: feature status and limitations

## Implemented in the browser prototype

- **Calendar and appointments:** day, week and month views; all-day appointments, travel time, planned/cancelled state, preparation notes and reminders; exact duplicate appointments are blocked; overlaps ask for confirmation; weekly repetition is expanded to a finite set; month dates support desktop drag-and-drop and appointment edits/deletes are recorded in history.
- **Support roster:** support-worker names, roles and resized profile photos; dated shifts; day/week views; add, edit and delete shifts.
- **Mood, journal and drawings:** five-step emoji mood check-in, saved entries and audio attachments, a keyboard/pointer drawing canvas, saved drawings, review and delete.
- **Step-by-step guides:** create instructions with steps, a resized photo and an audio attachment; mark steps complete and retain progress.
- **Trusted contacts:** store a contact and emergency notes; a prominent help action opens the device dialer or messaging app only after user confirmation.
- **Profiles and consent:** local user/support-worker/parent/guardian profiles, per-category consent records, consent revocation and a local invitation-code placeholder. Sharing defaults to off.
- **Reminders:** appointment reminders and one-off/daily/weekly reminders; duplicate records are avoided; snooze is available; quiet-hour settings are stored. A Capacitor local-notification bridge schedules up to 60 upcoming reminders, but scheduling after changes is refreshed when the app is open and unlocked and still needs physical-device tests. The browser-only prototype cannot guarantee background delivery.
- **Search and data controls:** search stored records; encrypted backup export/import with merge/replace choice; a separate encrypted recovery file; confirmation before deleting data; audit events. The Extra features workspace adds a personal emergency plan, goals/progress, small encrypted document attachments, worker absence and handover notes, opt-in weekly text reports, up to three local restore checkpoints, appointment change history, speech output/recognition and a simple mode.
- **Accessibility:** responsive layouts, labeled fields, keyboard-focus styles, larger-text/high-contrast/reduced-motion modes, semantic status areas and large touch controls.

## Security behavior

The Daily Life Suite puts its app records inside a local encrypted envelope using PBKDF2-SHA-256 and AES-256-GCM. A passphrase of at least 12 characters is required to create or unlock the vault. Plain text app records are not written as standalone local-storage entries by this module. The derived key exists only in the active page session; it is discarded on lock, after five minutes of inactivity, and when the page becomes hidden. Browser storage is still subject to device compromise, malicious extensions and unlocked-session access. Local storage quota may limit the number/size of attached photos and audio files.

The suite's encryption does **not** cover existing routine progress or accessibility preferences in the original prototype; those remain unencrypted until their storage model is upgraded. Keep the security limitations in DATA-PROTECTION.md in scope.

## Important limitations—not production-ready

- **Accounts need deployment configuration:** this branch adds Supabase Auth sign-up/login, password-reset requests, inactivity logout, optional TOTP screens and MFA-gated RLS. It does not provision the hosted Supabase project, SMTP, e-mail confirmation/redirects or deployment settings; test accounts and a real configuration are still required. Local profiles remain labels, not separate authenticated identities.
- **Remote invitation scope is metadata-only:** the SQL migration stores single-use, expiring invitation hashes and scoped caregiver/parent/guardian links with revocation. E-mail delivery is not wired, and the owner’s encrypted vault is not shared or decrypted for a caregiver. Do not treat the invitation scaffold as a deployed caregiver record-sharing service.
- **Cross-device transfer is encrypted snapshot sync, not record-level live sync:** when configured, the client can upload encrypted vault snapshots, detect a shared baseline and push one-sided local changes while the app is open. When both sides changed, the user must choose an upload or restore; restoration keeps a safety version. It does not merge individual records, and each device must use the same vault passphrase.
- **Native notification scheduling is wired but unverified on hardware:** scheduled Android/iOS local notifications can fire without server push, but updates are queued while the app is open and the vault is unlocked. Permission denial, reboot recovery, exact-alarm behavior, daylight-saving transitions and quiet hours need phone/tablet/iPhone testing. Browser reminders remain foreground-only.
- **Weekly appointment repeat is currently expanded to a finite set of future entries:** review generated entries and recurrence behavior before release.
- **Separate Android phone/tablet variants are now configured:** they use distinct package IDs and labels, with individual debug APKs and release APK/AAB candidates produced by GitHub Actions. The tablet web layout now uses a narrower navigation rail in portrait-size tablet widths. These artifacts still need installation and usability checks on actual phone and tablet hardware. Windows MSI and iOS archives also need real-device/installer verification; unsigned candidates are not production releases.
- **No independent security assessment:** the encryption design and data flows need review before storing real health, journal, voice or caregiver information.
- **No emergency dispatch:** the help button only opens the device's phone or messaging app. It does not call emergency services by itself and does not confirm that a message was sent.
- **Accessibility needs hands-on validation:** automated checks do not replace TalkBack, keyboard-only, magnification, high-contrast, and user testing on actual devices.

## Recommended release acceptance checks

1. Run npm test and JavaScript syntax checks; fix all red CI checks.
2. Test encrypted vault creation/unlock, wrong passphrase rejection, lock behavior, export/import, merge/replace and deletion on a real device.
3. Test exact duplicate and overlapping appointments, daylight-saving/timezone changes, repeat schedules and reminders.
4. Test photo/audio sizes near limits and failure handling when local storage is full.
5. Validate consent filtering and confirm profiles do not imply real authentication.
6. Test Android phone and tablet layout, offline startup, TalkBack and touch target sizes.
7. Complete threat-model, privacy and independent security review before production use.
