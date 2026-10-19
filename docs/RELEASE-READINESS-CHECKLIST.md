# NovaLife release readiness checklist

This checklist distinguishes a **test build** from a **production release**. Passing CI proves only that the automated checks and packaging steps passed; it does not prove that the app is safe for real care records.

## 1. Automated build gate

- [ ] Smoke tests pass on the exact commit being released.
- [ ] Feature-branch checks pass on the exact commit being released.
- [ ] Android workflow finishes successfully and uploads the APK, AAB, and SHA-256 checksum file.
- [ ] Downloaded files are non-empty and their SHA-256 values match the uploaded checksum file.
- [ ] Record the exact commit SHA, workflow run URL, and artifact names.
- [ ] Confirm whether each package is debug, release, signed, or unsigned. Never describe an unsigned package as store-ready.

## 2. Test-build gate

- [ ] Install the APK on a real Android phone and launch it from the launcher.
- [ ] Check the key screens, navigation, back button, offline behavior, and restart behavior.
- [ ] Check small and large display sizes, portrait/landscape where supported, text scaling, and TalkBack.
- [ ] Exercise profile separation and role/consent restrictions with separate test accounts and non-sensitive dummy data.
- [ ] Test export, restore, lock timeout, wrong credentials, and recovery flows.
- [ ] Check logs for crashes, secrets, access tokens, or personal data.
- [ ] Document known limitations and collect tester sign-off before sharing beyond the test group.

## 3. Production gate — required before real care data

- [ ] Implement and deploy a real authenticated backend; no client-provided role, profile, consent, or assignment may be trusted.
- [ ] Connect authorization checks to every API endpoint and enforce access in server-side queries.
- [ ] Use a real durable, shared session repository and trusted account repository; test revocation, expiry, account disablement, and database outages.
- [ ] Complete account creation, password/identity verification, recovery, rate limiting, secure transport, and session/cookie protections.
- [ ] Complete privacy review, data-processing/legal basis review, retention/deletion rules, backup/restore drills, and incident response.
- [ ] Complete independent security review and penetration tests for authentication, authorization, data isolation, exports, and recovery.
- [ ] Verify native secure storage, signing keys, release signing, update strategy, and secret management.
- [ ] Run accessibility and device tests with representative users; test all supported Android form factors separately.
- [ ] Confirm support ownership, monitoring, crash reporting privacy, and rollback procedure.
- [ ] Publish release notes and privacy information; obtain explicit release approval.

## Current known limitations

- The current Android workflow creates a **debug APK** and a **release AAB**. The workflow does not by itself establish that the AAB is signed for production distribution.
- A successful CI run is not a real-device installation test.
- The session-store adapter is repository-backed by interface, but a concrete durable production database adapter and trusted account repository still need to be deployed and tested.
- Authorization helpers and contracts are not a substitute for integrating enforcement into every real backend endpoint.
- Do not store real client or care data in this prototype until the production gate is completed.

## Release decision

Use the label **internal test build** only after the automated build and test-build gates pass. Use **production release** only after every production gate item is evidenced and signed off. If any required check is unknown or untested, the release remains blocked for real care data.
