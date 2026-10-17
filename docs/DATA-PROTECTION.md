# Data protection design — Project N-01

## Current state (prototype)

- When encrypted routine storage is not enabled, custom routines are stored in browser `localStorage` and are **not encrypted**. After the user enables the vault and optionally removes the old plaintext copy, custom routine templates are stored in an authenticated encrypted envelope. Accessibility preferences remain unencrypted in `localStorage`.
- Routine JSON exports are plaintext and must be treated as readable by anyone who obtains the file.
- Notes and drawings are currently temporary and are not persisted.
- The experimental `src/secure-storage.js` module provides Web Crypto AES-256-GCM encryption with a random 128-bit salt, random 96-bit IV, PBKDF2-SHA-256 key derivation, and a 128-bit authentication tag.
- The optional encrypted vault is connected to custom routine-template persistence. The user must unlock it with a passphrase on each page load; a derived `CryptoKey` is retained only in an in-memory closure while unlocked and is discarded on lock. This prototype has no inactivity auto-lock, key recovery or independent security review, so it is not yet a release-ready security guarantee.
- Browser encryption does not protect data from a compromised device, malicious browser extension, injected script, or someone with access to an unlocked app session.

## Proposed data categories

| Category | Proposed handling |
| --- | --- |
| Accessibility preferences | Non-sensitive settings; persist locally and minimize collection |
| Custom routine templates | Optional encrypted vault after passphrase unlock; old plaintext copy must be removed separately. Accessibility preferences remain unencrypted. |
| Mood entries, journal text, drawings, voice recordings | Sensitive; do not persist until encryption, deletion, backup and consent flows are implemented |
| Caregiver/guardian access | Explicit, revocable consent and separate authorization; never infer permission from device ownership |
| Backups | Versioned encrypted envelope; never include passwords or raw derived keys |

## Required integration before sensitive data is stored

1. Agree a threat model and decide whether the app is single-user per device or supports multiple profiles.
2. Design passphrase setup, unlock, lock timeout, password change and account/data deletion.
3. Define recovery honestly: if a user loses the passphrase and has no recovery key, encrypted data may be unrecoverable. Do not create a hidden server-side backdoor.
4. Continue reviewing the versioned encrypted storage repository; existing plaintext routines are copied only after a deliberate user action. Keep the plaintext copy until the user explicitly deletes it after checking the encrypted vault and downloaded backup.
5. Do not store the passphrase or derived key beside ciphertext. Keep keys in memory only for the minimum session and clear references on lock where feasible.
6. Encrypt backups with a separate user-held passphrase or key; validate file size, schema and version before importing.
7. Add cryptographic unit tests for round trip, wrong passphrase, modified ciphertext, invalid envelope, unsupported version, large payload and storage failure.
8. Review key-derivation performance on lower-end Android devices and obtain expert review of parameters.
9. Implement platform-native protection separately where appropriate: Android Keystore and Windows DPAPI/CNG. Browser storage encryption does not automatically cover native builds.
10. Perform independent security/privacy review and accessibility testing before storing real mood, journal or support information.

## Encryption envelope

The experimental envelope includes `format`, `version`, `kdf`, `iterations`, `cipher`, `salt`, `iv` and `ciphertext`. The passphrase and derived key are not serialized. AES-GCM authentication failures reject decryption. Format/version checks are strict to avoid silently accepting unknown schemes.

This is an engineering plan, not a certification, legal assessment, or claim that the current application encrypts data.


## Encrypted routine backup prototype

The routine screen now offers a separate encrypted JSON backup and restore flow. The user supplies a passphrase (minimum 12 characters); the passphrase field is cleared after the operation and is not written to the backup. The encrypted file is limited to 1 MiB on import and decrypted content is schema-checked before routines are added. Import merges routines and keeps the existing maximum of 50 templates.

**Important limitation:** the separate encrypted-backup import flow still merges restored routines into whichever routine store is currently active. If the vault is unlocked, the merge is encrypted; without the vault, the merge is stored in plaintext `localStorage`. The ordinary plaintext export remains available and is labelled unencrypted. Do not store sensitive journal or voice data in this prototype.


## Payload-size guard

The experimental Web Crypto helper now rejects values that cannot be serialized as JSON and caps plaintext and decrypted data at 1,000,000 bytes. Encrypted input is rejected if its decoded ciphertext exceeds the corresponding limit plus the 16-byte AES-GCM authentication tag. This defensive resource limit is not a substitute for a security review.


## Experimental encrypted vault adapter

`src/encrypted-vault.js` adds a standalone storage adapter that stores one AES-GCM envelope under a dedicated storage key, requires an explicit unlock, clears its in-memory plaintext on lock, and verifies the supplied passphrase against the existing envelope before replacing data. Restore authenticates the incoming envelope before writing it. Automated tests cover persistence shape, wrong passphrases, save and restore behavior.

The adapter is connected to the custom-routine editor after an explicit opt-in action. The user must enter the passphrase after each page load; while unlocked, creating, editing, deleting, and importing routine templates writes to the encrypted vault. The initial migration downloads an encrypted envelope and leaves the legacy plaintext copy in place until the user explicitly deletes it. Accessibility preferences still use ordinary unencrypted `localStorage`. The UI updates its privacy notice for unlocked/locked vault states. There is no inactivity auto-lock or recovery flow, and this has not received an independent security review. Do not store sensitive journal, mood, voice, or caregiver data in the prototype.


## Non-destructive routine migration helper

`src/routine-migration.js` can preview and normalize the existing plaintext custom-routine record, then copy valid routines into a new encrypted vault and verify the decrypted result. It deliberately preserves the original plaintext record and refuses to overwrite an existing vault or proceed when the legacy record is malformed. The UI now exposes a deliberate copy-and-download action. It checks for at least one valid legacy routine, verifies the encrypted copy through the helper, exports only the ciphertext envelope, and locks the helper in memory after the operation. It does not delete plaintext data automatically. After unlocking and checking the routines, the user can separately choose to delete the legacy plaintext copy. Normal routine changes use the encrypted vault while it is active; preferences remain plaintext, and lock timeout/recovery plus a safe rollback flow remain future work. Do not interpret this as full app-data encryption.
