# NovaLife — eigen zorg- en leefplatform

## Productbesluit
NovaLife wordt een zelfstandig product met een eigen merk, interface, gegevensmodel en toekomstige backend. Caren en Nedap Ons zijn uitsluitend inspiratie voor functionele behoeften; ze zijn geen verplichte integraties en hun merken, schermen of code worden niet gekopieerd. NovaLife bevat geen knoppen die gebruikers naar die websites sturen als vervanging voor eigen functies.

## Productgebieden

### Mijn NovaLife
- Persoonlijke startpagina, agenda, routines, stemming, dagboek en tekeningen.
- Persoonlijk verhaal met tekst en foto's.
- Toegankelijke weergave met grotere tekst, toetsenbordbediening, schermlezerlabels, hoog contrast en minder beweging.

### Mijn zorg
- Persoonlijk zorgplan, doelen, acties, evaluaties en voortgang.
- Zorgnotities, dagrapportages, incidentregistratie en overdracht.
- Documentenregister en later beveiligde bestandsopslag.
- Medicatieoverzicht als ondersteunend overzicht; pas na aparte validatie eventueel een formele medicatiewerklijst.
- Afspraken en relevante meldingen, met duidelijke status en herkomst.

### Mijn netwerk
- Cliënt bepaalt welke bevoegde personen betrokken zijn.
- Eigen contacten, rollen en uitnodigingen.
- Granulaire toestemming per gegevenstype, met overzicht van verleende en ingetrokken toegang.
- Berichten, leesstatus en bijlagen als backendfunctionaliteit beschikbaar is; lokale notities worden niet gepresenteerd als verzonden berichten.

### Planning
- Dag- en weekrooster voor cliënt en bevoegde medewerkers.
- Beschikbaarheid, afwezigheid, taken en toewijzing.
- Wijzigingshistorie, status en bevestiging waar nodig.

### Organisatie en medewerkers
- Eigen medewerkersprofielen, teamoverzicht, meldingen en werkafspraken.
- Rollen en rechten met minimale toegang.
- Goedkeuringsstappen en auditgeschiedenis voor gevoelige acties.

## Architectuur en veiligheid
1. Behoud bestaande routines, agenda, stemming, dagboek, tekeningen, versleutelde lokale kluis en aparte Android-telefoon/tablet-builds.
2. Bouw NovaLife-functies met eigen UI, eigen datamodellen, validatie, fout-/laad-/lege toestanden en geautomatiseerde tests.
3. De huidige browsermodule is een lokale prototype-kluis, geen multi-user accountsysteem. Noem lokale profielen geen geverifieerde accounts.
4. Echte accounts, rollen, uitnodigingen, berichten, gedeelde dossiers en synchronisatie vereisen een vertrouwde backend, server-side autorisatie, versleuteld transport en opslag, auditlogs, back-up/herstel en intrekbare toegang.
5. Zorggegevens zijn standaard privé. Controleer rechten op elke serveraanvraag; verberg functies niet alleen in de interface.
6. Implementeer geen directe Caren- of Nedap Ons-koppeling als vereiste. Een toekomstige export/import is een afzonderlijke keuze, met toestemming en expliciete herkomstlabels.
7. Geen claims over MedMij, wettelijke conformiteit, overheidserkenning, klinische geschiktheid of productierijpheid zonder formele toetsing.

## Leveringsvolgorde
- Fase A: bestaande functies inventariseren en behouden; NovaLife-merk en navigatie eenduidig maken.
- Fase B: lokale zorg-, documenten- en rapportagefuncties afronden met profielscheiding en tests.
- Fase C: eigen cliënt-/netwerk-/medewerkersrollen en toestemmingsmodel ontwerpen.
- Fase D: beveiligde backend, accounts, autorisatie, berichten en synchronisatie bouwen voordat gegevens op afstand worden gedeeld.
- Fase E: regressie-, beveiligings-, privacy- en toegankelijkheidstests; Android-telefoon en tablet apart testen; Windows/iOS apart valideren.

## Acceptatiecriteria
- De interface gebruikt NovaLife als productnaam en eigen vormgeving.
- Geen externe portaal-knoppen dienen als vervanging voor eigen functies.
- Bestaande appfuncties en gegevens blijven behouden.
- Iedere rol krijgt uitsluitend toegestane functies en gegevens.
- Geen gegevens worden gedeeld wanneer delen uitstaat.
- Intrekken van toegang werkt ook server-side.
- Tests dekken autorisatie, profielisolatie, toestemming, validatie, export en regressies.
- Builds en tests worden pas als groen gemeld na daadwerkelijke CI- en apparaattests.


## Role separation and client mood check-in — production gate

### Client-facing addition
- A client can record a self-reported signal colour: green (doing okay), orange (needs additional support), or red (needs help now), with an optional note.
- Reports are stored in the existing encrypted local vault and shown in the mood area. This is a self-report, not an emergency alert or clinical assessment.

### Role/security requirements before production
- The current app is a browser-only prototype with one local encrypted vault. Profiles and consent entries are local records, not independently authenticated accounts.
- Hiding a tab or adding a role field is not authorization. Do not use this prototype with real client/care records until a server-backed identity and authorization layer is implemented and independently reviewed.
- Required roles: client, caregiver, and developer administrator. The client must only see their personal features and their own mood reports. Caregivers must be assigned to clients by an authorized administrator and get caregiver portal features only for assigned clients. Developer administrators need audited, least-privilege support access, not an unauthenticated client-side override.
- Enforce permissions on every server/API operation, not just in the UI. Add secure account creation, role assignment, session expiry/revocation, audit trail, encrypted transport/storage, backups, and tests for cross-client access denial.
- Keep the local vault unlocked across normal in-app navigation; prompt again only after explicit lock/logout, inactivity/session expiry, or a security-sensitive re-authentication requirement. Never store the password itself for convenience.


## Role-based portal navigation prototype

The local prototype now applies a role-based navigation policy: client/self profiles do not see the caregiver care/roster areas or profile/consent administration; caregiver/parent/guardian profiles can see care and roster; only a provisioned developer-admin role can see profile/consent administration and switch profiles. Direct tab attempts fall back to the dashboard.

**Security boundary:** this is UI-level prototype gating only. The app still uses a single local encrypted vault, and profile records are not independently authenticated accounts. It does not yet provide secure multi-user accounts or server-side access enforcement. Do not store real care/client data in this prototype. Production completion requires backend identity, server-enforced roles, client assignment, audit logs, session revocation, secure hosting and independent privacy/security review. Never enable developer-admin by client-editable profile creation.

## Session behavior

The vault key stays in memory while the vault is unlocked; ordinary in-app navigation does not ask for the passphrase again. The passphrase is not stored in readable form. Explicit lock, inactivity timeout, or prolonged backgrounding returns to the unlock screen. If a user reports prompts on every feature despite staying active, treat that as a regression requiring device reproduction.
