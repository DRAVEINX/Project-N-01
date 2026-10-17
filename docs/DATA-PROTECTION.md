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
