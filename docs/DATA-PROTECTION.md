# Data protection design — Project N-01

## Current state (prototype)

- Custom routines and accessibility preferences are stored in browser `localStorage` and are **not encrypted**.
- Routine JSON exports are plaintext and must be treated as readable by anyone who obtains the file.
- Notes and drawings are currently temporary and are not persisted.
- The experimental `src/secure-storage.js` module provides Web Crypto AES-256-GCM encryption with a random 128-bit salt, random 96-bit IV, PBKDF2-SHA-256 key derivation, and a 128-bit authentication tag.
- The encryption module is **not connected to application storage**. It is a technical starting point, not a security guarantee or release-ready feature.
- Browser encryption does not protect data from a compromised device, malicious browser extension, injected script, or someone with access to an unlocked app session.

## Proposed data categories

| Category | Proposed handling |
| --- | --- |
| Accessibility preferences | Non-sensitive settings; persist locally and minimize collection |
| Custom routines and progress | Encrypt before durable storage after the full key and recovery flow is reviewed |
| Mood entries, journal text, drawings, voice recordings | Sensitive; do not persist until encryption, deletion, backup and consent flows are implemented |
| Caregiver/guardian access | Explicit, revocable consent and separate authorization; never infer permission from device ownership |
| Backups | Versioned encrypted envelope; never include passwords or raw derived keys |

## Required integration before sensitive data is stored

1. Agree a threat model and decide whether the app is single-user per device or supports multiple profiles.
2. Design passphrase setup, unlock, lock timeout, password change and account/data deletion.
3. Define recovery honestly: if a user loses the passphrase and has no recovery key, encrypted data may be unrecoverable. Do not create a hidden server-side backdoor.
4. Add a versioned encrypted storage repository and migrate existing plaintext routines only after clear consent and a recoverable backup.
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

**Important limitation:** the encrypted backup file is encrypted, but when restored, routines are still saved in the prototype's ordinary unencrypted browser `localStorage`. This is not end-to-end encrypted app storage. The existing plaintext export remains available and is still explicitly labelled as unencrypted. Do not store sensitive information in this prototype.


## Payload-size guard

The experimental Web Crypto helper now rejects values that cannot be serialized as JSON and caps plaintext and decrypted data at 1,000,000 bytes. Encrypted input is rejected if its decoded ciphertext exceeds the corresponding limit plus the 16-byte AES-GCM authentication tag. This defensive resource limit is not a substitute for a security review.


## Experimental encrypted vault adapter

`src/encrypted-vault.js` adds a standalone storage adapter that stores one AES-GCM envelope under a dedicated storage key, requires an explicit unlock, clears its in-memory plaintext on lock, and verifies the supplied passphrase against the existing envelope before replacing data. Restore authenticates the incoming envelope before writing it. Automated tests cover persistence shape, wrong passphrases, save and restore behavior.

This adapter is **not integrated into the app's current routine/preferences flow**. It does not migrate or delete existing plaintext data, does not provide inactivity auto-lock or recovery, and has not received an independent security review. The current app still stores routines and preferences unencrypted in `localStorage`; do not store sensitive information in the prototype.


## Non-destructive routine migration helper

`src/routine-migration.js` can preview and normalize the existing plaintext custom-routine record, then copy valid routines into a new encrypted vault and verify the decrypted result. It deliberately preserves the original plaintext record and refuses to overwrite an existing vault or proceed when the legacy record is malformed. The helper is not wired into the UI; the existing app continues to use plaintext `localStorage`. A separate, clearly confirmed cleanup flow and an end-to-end migration review are still required before integration.
