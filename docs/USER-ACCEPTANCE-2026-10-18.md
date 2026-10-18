# Project N-01 — user acceptance note

Date: 2026-10-18  
Branch: `feature/professional-suite-priority-1`

## User-reported result

The user confirmed: “alles werkt” (“everything works”). This records the user's practical acceptance report for the current tested experience, including the phone/tablet workflow discussed in this conversation.

This is user-reported acceptance, not independent verification by the maintainer. No device model, OS version, artifact checksum, or signing-certificate fingerprint was supplied in the confirmation.

## Automated build evidence

The latest regression workflow for the documentation branch succeeded on commit `5dcfee64ba27cfd696703413f02b5b9523d05e2d`:
- https://github.com/DRAVEINX/Project-N-01/actions/runs/39109833644

The last recorded successful cross-platform build set is on source commit `d43f216642c4745b3c8e3592a8c9d4abe87472c0`:
- Android build: https://github.com/DRAVEINX/Project-N-01/actions/runs/39109348863
- Windows MSI: https://github.com/DRAVEINX/Project-N-01/actions/runs/39109348849
- iOS archive: https://github.com/DRAVEINX/Project-N-01/actions/runs/39109348935
- Regression tests: https://github.com/DRAVEINX/Project-N-01/actions/runs/39109348866

## Remaining release gates

- Android release APK/AAB signatures and checksums still need to be recorded before distribution.
- Windows MSI and iOS archive are unsigned CI candidates unless a signing certificate/provisioning profile is configured.
- The account API/cloud sync is source code until deployed with HTTPS, production database, verified email and operational monitoring.
- Sensitive data protection still needs migration of remaining legacy plaintext fields, independent security review and privacy acceptance.
- User-reported functionality does not replace formal device/version-specific evidence.

Do not mark the project as a signed public production release solely on the basis of this note or green CI workflows.
