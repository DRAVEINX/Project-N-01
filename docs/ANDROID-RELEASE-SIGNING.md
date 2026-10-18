# NovaLife Android release signing

This guide configures the existing Android workflow to sign phone and tablet release APK/AAB files. Run this only on a trusted Windows computer. **Never commit the keystore or passwords to GitHub, and never send them in chat.**

## 1. Create a permanent upload key (Windows)

1. Install a current JDK if `keytool` is not available.
2. Open PowerShell in a private folder outside the repository, for example `$HOME\NovaLife-signing`.
3. Create the key. `keytool` will prompt for passwords and certificate details:

   ```powershell
   New-Item -ItemType Directory -Force "$HOME\NovaLife-signing" | Out-Null
   Set-Location "$HOME\NovaLife-signing"
   keytool -genkeypair -v -keystore novalife-upload-key.jks -alias novalife-upload -keyalg RSA -keysize 2048 -validity 10000
   ```

4. Keep a secure offline backup of `novalife-upload-key.jks` and its passwords. If you lose the upload key, recovery may require a key reset through Play Console. Do not generate a new key for every build.
5. Convert the keystore to one Base64 line and copy it to the clipboard:

   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("$HOME\NovaLife-signing\novalife-upload-key.jks")) | Set-Clipboard
   ```

## 2. Add GitHub Actions secrets

Open the repository **DRAVEINX/Project-N-01** on GitHub, select **Settings → Secrets and variables → Actions → New repository secret**, and add each secret below. Keep the signing material private.

| Secret name | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Paste the Base64 value copied in step 5 |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password entered when creating the key |
| `ANDROID_KEY_ALIAS` | `novalife-upload` |
| `ANDROID_KEY_PASSWORD` | Key password entered when creating the key (may be the same if you chose that) |

Do not put these values in source files, workflow YAML, issues, pull requests, or chat. The workflow already reads these exact secret names.

## 3. Run the signed build

1. Open **Actions → NovaLife Android build**.
2. Select **Run workflow**, choose branch `feature/novalife-rebrand`, then start it.
3. Wait for the run to finish. A green build alone is not enough: inspect the log to confirm it did **not** print `Android signing secrets are not configured`.
4. Download the artifacts `novalife-phone-release-candidate` and `novalife-tablet-release-candidate`. They should contain the respective APK and AAB outputs.
5. Before any release, verify signatures locally with Android SDK Build Tools:

   ```powershell
   apksigner verify --verbose --print-certs .\app-phone-release.apk
   apksigner verify --verbose --print-certs .\app-tablet-release.apk
   jarsigner -verify -verbose -certs .\app-phone-release.aab
   jarsigner -verify -verbose -certs .\app-tablet-release.aab
   ```

   Replace the example filenames with the actual extracted filenames. Check the reported certificate fingerprints and keep them documented privately for future comparisons.

## 4. Release safety gates

- Keep all changes on `feature/novalife-rebrand`; do not merge to `main` as part of this signing step.
- Preserve the existing application IDs, app data, encryption identifiers, and backup formats.
- Test install/upgrade on real phone and tablet devices and verify existing data and backup restore.
- Use the **phone AAB** for the first Google Play internal test. Tablet artifacts remain separate and must be tested independently.
- Signing does not complete Play Console declarations, privacy policy, Data safety, content rating, screenshots, or legal name/trademark checks. Do not claim the app is ready for public release until those gates pass.
