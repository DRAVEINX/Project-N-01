# Data protection design — Project N-01

## Current state (prototype)

- When the encrypted vault is not enabled, custom routine templates may remain in browser `localStorage` and are **not encrypted**. Accessibility preferences and today's checklist progress remain unencrypted in browser storage. The user must separately verify and remove any older plaintext routine copy.
- Ordinary custom-routine JSON exports are plaintext. The separate routines-only encrypted backup protects only routine templates. The full-vault backup downloads the complete encrypted envelope, including every supported data collection currently stored in the vault.
- Journal entries and drawings are persisted only after an explicit save action. The week planner, mood check-ins and trusted-person records are also saved through the encrypted local vault when it is unlocked; the app does not send these entries to a server.
- The experimental `src/secure-storage.js` module uses Web Crypto AES-GCM encryption with a random 128-bit salt, random 96-bit IV, PBKDF2-SHA-256 key derivation, and a 128-bit authentication tag.
- The optional encrypted vault holds routine templates and explicitly saved personal data in one authenticated envelope. The user must unlock it with a passphrase after a fresh page load; the derived `CryptoKey` is kept only within an in-memory session while unlocked and is discarded on lock. The prototype auto-locks after five minutes without activity and when the page is hidden or navigated away from. Passphrase recovery and independent security review are still missing, so this is not a release-ready security guarantee.
- Browser encryption does not protect data on a compromised device, from a malicious browser extension or injected script, or from someone with access to an unlocked app session.

## Proposed data categories

| Category | Proposed handling |
| --- | --- |
| Accessibility preferences | Non-sensitive settings; persist locally and minimize collection |
| Custom routine templates | Optional encrypted vault after passphrase unlock; old plaintext copy must be removed separately. Accessibility preferences remain unencrypted. |
| Mood entries, journal text and saved drawings | Explicitly saved in the experimental encrypted vault; full-vault backup/restore exists, but deletion, recovery, threat-model and security review remain incomplete |
| Caregiver/guardian access | Explicit, revocable consent and separate authorization; never infer permission from device ownership |
| Backups | Full-vault backup is an encrypted envelope and restore validates size/structure before replacing the current vault; it uses the vault passphrase and has no recovery service |

## Required work before production release

1. Agree a threat model and decide whether the app is single-user per device or supports multiple profiles.
2. Design passphrase setup, unlock, lock timeout, password change and account/data deletion.
3. Define recovery honestly: if a user loses the passphrase and has no recovery key, encrypted data may be unrecoverable. Do not create a hidden server-side backdoor.
4. Continue reviewing the versioned encrypted storage repository; existing plaintext routines are copied only after a deliberate user action. Keep the plaintext copy until the user explicitly deletes it after checking the encrypted vault and downloaded backup.
5. Do not store the passphrase or derived key beside ciphertext. Keep keys in memory only for the minimum session and clear references on lock where feasible.
6. Consider a separate user-held backup passphrase, and keep validating file size, schema and envelope version before importing. Current full-vault backups use the vault passphrase; there is no recovery service.
7. Add cryptographic unit tests for round trip, wrong passphrase, modified ciphertext, invalid envelope, unsupported version, large payload and storage failure.
8. Review key-derivation performance on lower-end Android devices and obtain expert review of parameters.
9. Implement platform-native protection separately where appropriate: Android Keystore and Windows DPAPI/CNG. Browser storage encryption does not automatically cover native builds.
10. Perform independent security/privacy review and accessibility testing before storing real mood, journal or support information.

## Encryption envelope

The experimental envelope includes `format`, `version`, `kdf`, `iterations`, `cipher`, `salt`, `iv` and `ciphertext`. The passphrase and derived key are not serialized. AES-GCM authentication failures reject decryption. Format/version checks are strict to avoid silently accepting unknown schemes.

This is an engineering plan, not a certification, legal assessment, or claim that the current application encrypts data.


## Encrypted backups and restore

The routine-only encrypted backup flow exports/imports routine templates and merges imported templates into the current routine collection. It does not restore journal entries, drawings, appointments, moods or trusted contacts from a full-vault envelope. Ordinary routine exports are unencrypted and are labelled as such.

The full-vault backup action downloads the encrypted vault envelope, which contains all current data in the vault rather than only routines. The separate **Restore full encrypted vault** control requires the vault passphrase and a confirmation before replacement. The restored plaintext is validated before the adapter writes the incoming envelope: overall size and collection counts are bounded, and fields such as dates, mood scores, photo data URLs and text lengths are checked. Files larger than 2 MiB are rejected. A wrong passphrase, invalid envelope or unsupported data shape must leave the prior stored vault untouched.

**Important limitations:** the full backup uses the same passphrase as the vault and cannot be recovered if that passphrase is lost. The prototype is not independently security-reviewed, does not provide cross-device sync or recovery, and should not be treated as production-ready for highly sensitive information.


## Payload-size guard

The experimental Web Crypto helper now rejects values that cannot be serialized as JSON and caps plaintext and decrypted data at 1,000,000 bytes. Encrypted input is rejected if its decoded ciphertext exceeds the corresponding limit plus the 16-byte AES-GCM authentication tag. This defensive resource limit is not a substitute for a security review.


## Experimental encrypted vault adapter

`src/encrypted-vault.js` adds a standalone storage adapter that stores one AES-GCM envelope under a dedicated storage key, requires an explicit unlock, clears its in-memory plaintext on lock, and verifies the supplied passphrase against the existing envelope before replacing data. Restore authenticates the incoming envelope before writing it. Automated tests cover persistence shape, wrong passphrases, save and restore behavior.

The adapter is connected to the custom-routine editor after an explicit opt-in action. The user must enter the passphrase after each page load; while unlocked, creating, editing, deleting, and importing routine templates writes to the encrypted vault. The initial migration downloads an encrypted envelope and leaves the legacy plaintext copy in place until the user explicitly deletes it. Accessibility preferences still use ordinary unencrypted `localStorage`. First-time vault creation asks the user to enter the passphrase twice and refuses to create the vault if the entries differ; both input fields are cleared after the attempt. Existing-vault unlocks do not require confirmation. The UI updates its privacy notice for unlocked/locked vault states. The UI locks after five minutes without activity and when the page is hidden or navigated away from. The routines-only encrypted import control accepts both versioned routine-backup payloads and an encrypted vault envelope but deliberately extracts and merges only its `routines` collection. It is not a complete vault restore. Use the separate full-vault restore control to replace the full stored envelope after explicit confirmation and pre-write validation. Recovery, device-level testing and independent security review are still missing.


## Non-destructive routine migration helper

`src/routine-migration.js` can preview and normalize the existing plaintext custom-routine record, then copy valid routines into a new encrypted vault and verify the decrypted result. It deliberately preserves the original plaintext record and refuses to overwrite an existing vault or proceed when the legacy record is malformed. The UI now exposes a deliberate copy-and-download action. It checks for at least one valid legacy routine, verifies the encrypted copy through the helper, exports only the ciphertext envelope, and locks the helper in memory after the operation. It does not delete plaintext data automatically. After unlocking and checking the routines, the user can separately choose to delete the legacy plaintext copy. Normal routine changes use the encrypted vault while it is active; preferences remain plaintext. The inactivity/tab-hide lock is implemented, while recovery and a safe rollback flow remain future work. Do not interpret this as full app-data encryption.
