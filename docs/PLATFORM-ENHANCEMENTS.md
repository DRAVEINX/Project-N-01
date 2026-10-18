# Project N-01 — account, sync and platform enhancements

This change adds the client integration and a Supabase migration. It does **not** create a hosted Supabase project, enable e-mail delivery, configure DNS, or provide a signing certificate. Accounts and cloud sync become available only after an operator applies the migration and enters their own project URL plus the public anon/publishable key in the app.

## Account setup
1. Create a Supabase project and review its authentication settings.
2. Apply \`supabase/migrations/20261018090000_project_n01_cloud.sql\` in that project's SQL editor.
3. Configure e-mail confirmation and password recovery URLs for the app origin. Configure SMTP delivery in Supabase for reliable delivery.
4. In Project N-01, enter the project's HTTPS URL and its **anon/publishable** key. Never enter a \`service_role\` key.
5. Test sign-up, e-mail confirmation, password recovery, login/logout, inactivity logout, TOTP setup and sign-in on a test account before real data is used.

The browser keeps the active auth session in \`sessionStorage\`, not in long-lived local storage. An active account is logged out after 15 minutes without interaction. The main personal vault has its own five-minute lock. TOTP requires the Supabase Auth MFA feature to be enabled for the project.

## Cross-device recovery and sync semantics
The browser submits only the existing encrypted local vault envelope. The server-side table contains ciphertext, a hash and version/device metadata; it does not receive plaintext journal, audio or mood content from this snapshot API. Each upload creates a new version. If local and cloud hashes differ, the UI asks the user to choose rather than silently overwrite either copy. Restoring first pushes a safety snapshot, then replaces local ciphertext and reloads.

Use the same personal vault passphrase on each device that needs to decrypt the same restored vault. This implementation is encrypted snapshot sync with manual conflict selection, **not a transparent real-time per-record merge**. Offline changes remain on that device until it can reach the service; a new remote version is never silently merged.

## Care invitations and role access
The migration creates short-lived, one-use invite codes bound to the intended e-mail address. The recipient must sign in with that address. The schema enforces read/write scopes in the database for future shared-record endpoints. The owner can revoke an access link. The app currently does not e-mail invitations automatically, and it does not share/decrypt the owner's main vault with caregivers. The vault passphrase is never placed in an invitation. Do not treat a local profile as a separate authenticated identity.

## Native notifications
A native Local Notifications plugin bridge is built into the Android/iOS package by \`npm run build:mobile\`. Native reminders schedule from locally unlocked app data and require permission from the operating system. Android/iOS behavior must be tested on physical devices, including after reboot, permission denial and time-zone/daylight-saving transitions. Scheduling is only refreshed when the app is open with its vault unlocked; a background/server push service is not included.

## Data protection and operations
- New goals, documents, handovers, absences, checkpoints and support records use the encrypted life-suite vault.
- The existing prototype's previous daily task progress and global accessibility preferences were historically stored in local browser storage. The app must migrate those before claiming complete encryption; the migration controls and any remaining plaintext data are documented in the data-protection page.
- Recovery needs the local backup's existing vault passphrase or the separate recovery code. Lost secrets cannot be reconstructed by the server.
- Configure retention, account deletion, e-mail templates, terms/privacy contact and regional processing choices for the actual deployed service.
- Complete independent security and accessibility reviews before storing real journal, support or health information.
