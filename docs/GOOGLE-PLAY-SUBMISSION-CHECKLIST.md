# NovaLife — Google Play submission checklist (Android phone and tablet)

Scope: Android only. iOS is intentionally deferred.

## Build and package requirements

- [ ] Latest Android workflow on `feature/novalife-rebrand` finishes green.
- [ ] The build log confirms target API 36 or higher.
- [ ] Download `novalife-phone-release-candidate` and `novalife-tablet-release-candidate` from the same successful run.
- [ ] Unzip each artifact and upload the **.aab** to Google Play Console. The APK is for direct installation/testing, not the normal Play Store release upload.
- [ ] Confirm both AABs are signed with the intended upload key and Play App Signing is enabled/configured in Play Console.
- [ ] Keep the upload keystore and passwords private; do not put them in Git or send them in chat.
- [ ] Record the exact commit SHA, version name, version code and SHA-256 for each uploaded AAB.
- [ ] Test upgrade over an existing installation, data preservation, backup/restore, notifications and permission prompts on phone and tablet.

## Important: two separate Play listings

The build creates two distinct application IDs: `com.draveinx.projectn01.phone` and `com.draveinx.projectn01.tablet`. Google Play treats these as two separate apps/listings. Create and configure both entries separately if both are to be submitted. A single Play listing cannot use two different application IDs as alternate packages.

## Store listing and policy tasks in Play Console

- [ ] App name and descriptions in Dutch (and English if desired), with no unsupported claims.
- [ ] App icon (512 × 512), feature graphic (1024 × 500), phone screenshots and tablet screenshots.
- [ ] Public privacy-policy URL that accurately describes local data, journal/voice/photos, encryption, backups, deletion and any server use.
- [ ] Complete Data safety form based on actual behavior and any SDK/network traffic; do not guess or claim data is never collected without verifying.
- [ ] Complete content rating questionnaire, target audience/age, ads declaration, app-access instructions and permissions declarations.
- [ ] Provide review instructions and any test credentials required by Google; never place production secrets in review notes.
- [ ] Check Play Console's pre-launch report, app-content warnings and policy status before promoting a release.

## Account and release-track caveat

If this is a personal developer account created after 13 November 2023, Google currently requires a closed test with at least 12 testers opted in continuously for 14 days before applying for production access. You may be able to upload tomorrow and start/continue testing, but public production availability may not be possible tomorrow. Check the requirements shown for your specific Play Console account.

## Known product limitations to disclose accurately

- The app has local encrypted-suite storage, but some original routine progress and accessibility preferences are still outside that vault.
- Cross-device sync and real caregiver sharing are not yet production-ready.
- Background reminders and TalkBack/accessibility need hands-on validation.
- Do not claim independent security certification or production-grade security review.

## Release decision

Do not call the Android builds submission-ready until the latest AABs are generated successfully, their signatures and target API are confirmed, Play Console accepts the bundles, and the store listing/policy forms are complete. Uploading is not the same as Google approval or public release.
