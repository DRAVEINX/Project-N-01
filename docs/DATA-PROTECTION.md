# Data protection design — Project N-01

## Current development-branch behavior

The app has two layers that must not be confused:

1. A local personal vault used by the Life Suite to encrypt the personal records held inside it.
2. A separate account API that can store and return only the encrypted vault envelope. The API does not know the vault passphrase and cannot decrypt mood entries, journal text, contacts, attachments or other vault records.

The local vault uses PBKDF2-SHA-256 with 310,000 iterations and AES-256-GCM. Its passphrase must be at least 12 characters. A derived Web Crypto key is held in memory while unlocked and is discarded on lock. The Life Suite locks after five minutes of inactivity and when the page becomes hidden. This behavior is a prototype, not a guarantee against device compromise, malicious extensions/injected scripts or access to an unlocked session.

### What is protected by the local vault

- Life Suite appointments, roster data, mood entries, journal text/audio, drawings, guides, trusted contacts and reminders.
- New professional workspace goals, documents (including stored attachments within the size limit), handovers, absence notes, emergency plan and report preferences.
- Daily task/routine progress and the additional accessibility preferences when the user has successfully created/unlocked the Life Suite vault.
- Encrypted export, separate recovery-file/code flow, and the last ten professional-workspace data snapshots.

When a vault is unlocked, the app attempts to migrate legacy daily progress and accessibility settings from the older local-storage keys into the vault; the old keys are removed only if the encrypted save succeeds. If a user never unlocks/creates the vault, or migration fails, older plain values may remain. The current implementation does not claim that every legacy/custom routine template and every setting is automatically encrypted without a migration step; review the routine-vault controls and remove plaintext copies only after verifying an encrypted backup.

### Important limits still present

- Native Android Keystore / Apple's appropriate keychain APIs / Windows native secret protection are not yet integrated into the personal vault. The encryption key is derived from a user passphrase in the web layer, not a hardware-backed per-device key.
- The server API is a separate, optional service. It stores a JSON file database and uses process-local throttling. It must be migrated to a transactional database and production security controls before handling sensitive data.
- Account password reset does not recover or reset the local vault passphrase. If the passphrase is lost and there is no valid encrypted backup plus its separate recovery code, vault data may be unrecoverable.
- The account API does not read or decrypt the vault, but the current invited caregiver/parent/guardian records do not yet receive access to another user's encrypted payload. Consent/scopes in local profiles are not a substitute for authenticated authorization.
- Cross-device sync moves the whole encrypted vault envelope and uses revision checks. It does not merge individual records or reconcile offline edits item by item. The UI stops when the server revision differs and requires the user to make an explicit decision.
- Downloaded backups and documents exported to the filesystem are outside the app's vault. The user must protect and delete those separately.
- Routine progress is only persisted securely while the personal vault is unlocked. Until migration successfully finishes, legacy local-storage data may remain readable by other code running on the origin.
- Native local notifications are scheduled by the Capacitor plugin only after the user opts in and grants permission. Android exact alarms can require explicit OS authorization; battery management can still delay notifications. Test on actual devices and current iOS/Android releases.
- No independent security review, privacy assessment, production pentest or formal accessibility audit has been completed.

## Password and key handling

- Account passwords are hashed using Node.js scrypt on the API server. The API returns a random bearer token and stores only its hash; the front-end keeps the token in memory and logs out its local UI after 15 minutes without interaction.
- Optional account TOTP secrets are encrypted at rest using a server-side secret. Keep the server secret in a secret manager; do not commit it to source.
- Password reset uses a short-lived token (30 minutes) that is sent through a configured delivery webhook. The endpoint returns a generic response whether or not an account exists. The email webhook is not supplied/configured by the repository itself.
- Account deletion removes API account/session/reset/invite metadata and the server-side encrypted sync copy. It does not clear device-local vaults, browser caches, exported files, screenshots, native app data on other devices or any records held by an external email provider.
- A remote sync payload is validated as the expected AES-GCM envelope format and is opaque to the server. TLS/HTTPS is still required in any deployed environment; encryption-at-rest on the server does not replace secure transport or access control.

## Required before production

1. Review and document a threat model, roles, sensitive data, device-loss and recovery scenarios.
2. Migrate API persistence to a managed transactional database with unique constraints, transaction locks and tested backups; do not run multiple JSON-file API instances.
3. Add a durable distributed rate limiter, audit/monitoring/alerts, abuse controls, server-secret rotation and a managed key service.
4. Add native platform key handling, secure token storage, and a carefully designed session/logout model.
5. Build real invitation-based sharing with key exchange, server-side scope enforcement, revocation and tests proving a caregiver cannot read unauthorized content.
6. Test export/restore, wrong passphrase, tampered ciphertext, invalid envelope, large inputs, device restoration, DST and timezone behavior, and delete-all-data semantics.
7. Complete independent security and privacy review plus hands-on accessibility testing before storing real journal, mood, support or other sensitive information.

This is an engineering design/status record, not a legal assessment, certification, or claim that the current prototype is production-ready.
