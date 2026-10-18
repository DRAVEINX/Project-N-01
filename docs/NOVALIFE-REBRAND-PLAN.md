# NovaLife rebrand implementation plan

## Scope
The selected public product name is **NovaLife**. This branch changes user-facing branding only while preserving the repository name, application IDs, data-storage keys, encryption identifiers, and phone/tablet product flavors.

## Safety boundaries
- Work on `feature/novalife-rebrand`; do not push these changes to `main` directly.
- Preserve `com.draveinx.projectn01` and the phone/tablet suffixes. Changing application IDs can make existing installations behave like separate apps and is not part of this display-name change.
- Preserve existing local-storage keys, encrypted-vault identifiers, backup formats, and migration logic so existing user data remains discoverable.
- Keep CI artifact names and repository paths stable for traceability unless a separate release-process change is reviewed.
- Treat NovaLife as a provisional brand until Google Play name searches and relevant BOIP/EUIPO trademark checks are completed. This plan is not legal clearance.

## Changes in this branch
- Browser title, app shell labels, offline page, and PWA manifest use NovaLife.
- Capacitor appName is NovaLife; appId remains unchanged.
- Android phone and tablet launcher labels use NovaLife Telefoon and NovaLife Tablet.
- Windows window/product/installer display name uses NovaLife; desktop application ID remains unchanged.
- Android and Windows workflows include this branch so its changes can be built independently.
- Regression tests are updated to expect the new user-facing name.

## Release gates
1. Run all regression tests and Android, Windows, and iOS workflows on this exact branch revision.
2. Inspect phone and tablet APK/AAB output, package IDs, and signing certificate; install each on a real device.
3. Verify an upgrade preserves local data and encrypted backups can still be restored.
4. Install and launch the Windows MSI and verify its displayed product name.
5. Complete Google Play first-submission requirements, privacy policy, Data safety and app-content declarations.
6. Do not merge or submit until checks pass and the NovaLife name has been checked in the intended markets.

## Explicitly not done by a display-name change
This branch does not establish legal trademark rights, sign release artifacts, complete Google Play Console declarations, or prove physical-device acceptance. The original project branch and main remain available as rollback references.
