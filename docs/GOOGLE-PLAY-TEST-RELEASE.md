# NovaLife — Google Play closed-test release checklist

This guide prepares a **closed-test** release. It does not claim that NovaLife is production-ready or that Google Play has accepted it.

## 1. Create and protect the upload key (Windows)

Use a trusted local JDK. In PowerShell, run this in a private folder (not inside the repository):

```powershell
keytool -genkeypair -v -keystore novalife-upload-key.jks -alias novalife-upload -keyalg RSA -keysize 2048 -validity 10000
```

Enter a strong keystore password and key password when prompted. Keep the keystore and passwords private. Make at least one secure offline backup. **Never commit the keystore or paste it into chat.** Losing the upload key can complicate future updates; protect it accordingly.

Create a Base64 value in PowerShell without printing the keystore bytes:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$PWD\novalife-upload-key.jks")) | Set-Clipboard
```

Paste that value directly into GitHub's secret form, not into an issue, commit, or chat.

## 2. Add GitHub Actions secrets

In the GitHub repository, open **Settings → Secrets and variables → Actions → New repository secret**. Add all four names exactly:

- `ANDROID_KEYSTORE_BASE64`: Base64 text of the upload keystore
- `ANDROID_KEYSTORE_PASSWORD`: keystore password
- `ANDROID_KEY_ALIAS`: `novalife-upload` (or the alias you actually used)
- `ANDROID_KEY_PASSWORD`: password for the key

Do not send any of these values to anyone. Do not add them to a workflow YAML file or commit them to Git.

## 3. Run and verify the Android workflow

Open **Actions → Project N-01 Android build → Run workflow** on the intended feature branch. The workflow is designed to fail at its signing gate if the signing secrets are absent or invalid. When it succeeds, check the logs and artifacts to confirm:
- phone and tablet debug APKs are present for test installation;
- phone and tablet release APK/AAB artifacts are produced;
- release APK signatures verify and AAB signatures verify;
- the checksum file exists.

A successful build is not by itself proof that the app is compliant with Play policy. Verify the actual target SDK, package ID, version code/name, permissions and installed behavior for the exact artifact before uploading. Do not upload debug APKs to Play Console.

The workflow configures separate phone and tablet package IDs. Choose the intended **phone release AAB** for the first Play Console listing unless you intentionally plan a separate tablet listing; do not upload a tablet variant by accident.

## 4. Play Console closed test

In Play Console:
1. Complete the app setup and store-listing fields.
2. Complete the app-content declarations, content rating, target audience, app access instructions, and Data safety form truthfully.
3. Provide a public privacy-policy URL that matches the app's actual data handling. A local Markdown file or GitHub issue is not a substitute for a public policy URL.
4. Create a **closed testing** track, create a release, upload the signed phone AAB and resolve every validation error.
5. Add testers using a tester list or Google Group and share the Play opt-in link. Confirm at least 12 testers have actually opted in and remain opted in for the required 14 consecutive days for a new personal developer account.
6. Gather feedback and fix material issues before requesting production access.

## 5. Current release blockers

- Project documentation still identifies NovaLife as a prototype and lists unresolved security, privacy, accessibility and real-device checks.
- The repository paths `privacy.html`, `PRIVACY.md` and `docs/PRIVACY-POLICY.md` were not found at the time this checklist was written. Confirm whether a correct public privacy policy exists elsewhere before submitting.
- Confirm target API level 36 or higher for new apps/updates subject to the current Google Play requirement.
- Do not use real sensitive journal, mood, voice or caregiver data during testing until the documented data-protection and security issues have been addressed.

## Status labels

- **Prepared:** steps and configuration are ready.
- **Built:** CI generated artifacts.
- **Signed:** signature verification passed for the exact artifact.
- **Uploaded:** Play Console accepted the artifact into a test track.
- **Testing complete:** Google Play's required tester/time criteria were met.
- **Production access granted:** Google approved the request.

Never treat one status as proof of a later status.
