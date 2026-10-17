# Daily Life Suite: feature status and limitations

## Implemented in the browser prototype

- **Calendar and appointments:** day, week and month views; add, edit and delete appointments; date/time validation; exact same-start collision is blocked; partial time overlaps ask for confirmation; preparation notes, location, reminders and a weekly-repeat option are provided.
- **Support roster:** support-worker names, roles and resized profile photos; dated shifts; day/week views; add, edit and delete shifts.
- **Mood, journal and drawings:** five-step emoji mood check-in, saved entries and audio attachments, a keyboard/pointer drawing canvas, saved drawings, review and delete.
- **Step-by-step guides:** create instructions with steps, a resized photo and an audio attachment; mark steps complete and retain progress.
- **Trusted contacts:** store a contact and emergency notes; a prominent help action opens the device dialer or messaging app only after user confirmation.
- **Profiles and consent:** local user/support-worker/parent/guardian profiles, per-category consent records, consent revocation and a local invitation-code placeholder. Sharing defaults to off.
- **Reminders:** appointment reminders and one-off/daily/weekly reminders; avoid duplicate reminder records; snooze a reminder; request browser notification permission.
- **Search and data controls:** search stored records; encrypted backup export; backup import with merge/replace choice; a separate encrypted recovery file protected by a randomly generated recovery code that is shown once; confirm-before-delete data control; audit events for important local changes.
- **Accessibility:** responsive layouts, labeled fields, keyboard-focus styles, larger-text/high-contrast/reduced-motion modes, semantic status areas and large touch controls.

## Security behavior

The Daily Life Suite puts its app records inside a local encrypted envelope using PBKDF2-SHA-256 and AES-256-GCM. A passphrase of at least 12 characters is required to create or unlock the vault. Plain text app records are not written as standalone local-storage entries by this module. The derived key exists only in the active page session; it is discarded on lock, after five minutes of inactivity, and when the page becomes hidden. Browser storage is still subject to device compromise, malicious extensions and unlocked-session access. Local storage quota may limit the number/size of attached photos and audio files.

The suite's encryption does **not** cover existing routine progress or accessibility preferences in the original prototype; those remain unencrypted until their storage model is upgraded. Keep the security limitations in DATA-PROTECTION.md in scope.

## Important limitations—not production-ready

- **No authenticated remote accounts:** local profiles help organize data but are not separate security principals. All local suite records use the same vault passphrase.
- **No real remote invitations yet:** generated invitation codes are local records only. Do not use them to grant real-world access; securely accepting an invitation on another device needs a server-side identity and authorization service.
- **No live cross-device sync yet:** encrypted export/import is a manual transfer workflow. Merge shows a content-free conflict report and automatically keeps the latest updated version for matching IDs; the user cannot yet choose the winning version item by item.
- **Background notifications are not guaranteed:** reminders are evaluated while the page is visible and unlocked. Closing, locking or backgrounding the page stops reminder processing. Native Android scheduling and server/push support remain future platform work.
- **Weekly appointment repeat is currently expanded to a finite set of future entries:** review generated entries and recurrence behavior before release.
- **Phone/tablet/Windows/iOS are not yet verified release targets:** the Android workflow packages the responsive web assets, but real device tests and platform-specific release builds are separate tasks.
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
