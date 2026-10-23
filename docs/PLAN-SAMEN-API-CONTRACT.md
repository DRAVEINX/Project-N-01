# PlanSamen API-contract (ontwerp)

Status: contract voor implementatie en review; er draait nog geen PlanSamen-backend. Dit document is geen bewijs dat endpoints bestaan. Gebruik uitsluitend een apart goedgekeurd PlanSamen-project. Gebruik of wijzig NovaLife niet.

## Algemene regels

- HTTPS verplicht; authenticatie via een nog te kiezen vertrouwde identity provider.
- De server haalt de actor-ID uit de gevalideerde sessie/token. Vertrouw nooit een meegestuurde `user_id`, `role` of `created_by_user_id` als bewijs van identiteit.
- Autorisatie wordt server-side gecontroleerd bij iedere aanvraag en iedere afspraakmutatie.
- Valideer invoer en geef geen gevoelige notities terug aan niet-geautoriseerde gebruikers.
- Gebruik UTC RFC 3339-tijdstempels in opslag en API-responses; bewaar de IANA-tijdzone voor weergave.
- Pictogrammen zijn optioneel qua betekenis, maar bij ontbrekende keuze wordt een veilige standaard getoond. Een pictogram vervangt nooit een tekstlabel.
- Stuur nooit databasewachtwoorden, service-role-sleutels of andere geheimen naar de app.
- Geef bij een overlap een stabiele foutcode `APPOINTMENT_OVERLAP`; stuur geen inhoud van de conflicterende afspraak terug.

## Endpoints (voorstel)

| Methode en pad | Doel | Toegangscontrole |
|---|---|---|
| `GET /v1/me` | Eigen profiel en effectieve rol ophalen | Geldige sessie; alleen eigen profiel |
| `PATCH /v1/me` | Veilige profielvelden wijzigen | Alleen eigen profiel; rol kan niet via dit endpoint worden gewijzigd |
| `GET /v1/relationships` | Eigen cliënt-/begeleiderrelaties bekijken | Alleen actor als deelnemer; geen verborgen cliëntlijsten |
| `POST /v1/relationships/invitations` | Uitnodiging aanvragen | Server bepaalt uitnodiger; rate limit en auditlog |
| `POST /v1/relationships/{id}/accept` | Uitnodiging accepteren | Alleen de beoogde ontvanger; rol en relatie worden server-side gevalideerd |
| `POST /v1/relationships/{id}/revoke` | Relatie intrekken | Alleen bevoegde deelnemer/beheerflow; toekomstige toegang direct blokkeren |
| `GET /v1/appointments?from=...&to=...` | Afspraken binnen periode ophalen | Alleen eigen cliëntagenda of agenda van cliënt met actieve relatie |
| `POST /v1/appointments` | Afspraak aanmaken | Actor mag voor deze cliënt plannen; server stelt maker-ID in |
| `PATCH /v1/appointments/{id}` | Afspraak wijzigen | Autorisatie opnieuw controleren; overlapconstraint in database blijft leidend |
| `POST /v1/appointments/{id}/cancel` | Afspraak annuleren | Zelfde toegangscontrole als wijzigen; auditgebeurtenis vastleggen |

## Foutcodes

- `401 AUTHENTICATION_REQUIRED`: sessie ontbreekt of is ongeldig.
- `403 FORBIDDEN`: actor heeft geen rechten voor deze cliënt of actie.
- `404 NOT_FOUND`: object bestaat niet of mag voor deze actor niet zichtbaar zijn.
- `409 APPOINTMENT_OVERLAP`: afspraak botst met een bestaande actieve afspraak.
- `409 RELATIONSHIP_NOT_ACTIVE`: vereiste cliënt-begeleiderrelatie is niet actief.
- `422 VALIDATION_ERROR`: ongeldige titel, tijdzone of tijdsperiode.
- `429 RATE_LIMITED`: te veel verzoeken.

Foutmeldingen zijn kort en begrijpelijk in de app; interne SQL-, token- of stacktrace-details worden nooit getoond.

## Verplichte beveiligingstests

1. Een cliënt A kan geen profiel, relatie of afspraak van cliënt B ophalen door een ID in de URL te veranderen.
2. Een begeleider zonder actieve relatie krijgt geen toegang; na intrekken van de relatie werkt eerder verkregen toegang niet meer.
3. Een client kan zichzelf niet via `PATCH /v1/me` tot begeleider of beheerder promoveren.
4. De server negeert of weigert een door de client vervalst maker-ID of rol.
5. Twee gelijktijdige POST-verzoeken voor overlappende tijden resulteren in maximaal één opgeslagen afspraak; het andere verzoek krijgt `409 APPOINTMENT_OVERLAP`.
6. Een niet-overlappende afspraak die exact aansluit op de vorige wordt geaccepteerd.
7. Tests controleren zowel toegestane als geweigerde toegang, inclusief anonieme verzoeken.
8. Logging bevat actor, actie, objecttype en tijd, maar geen afspraaknotities, tokens of wachtwoorden.

## Nog te besluiten vóór implementatie

- Identity provider en hosting voor een apart PlanSamen-project.
- Wie cliënt-begeleiderrelaties mag uitnodigen en activeren, en hoe ouder/voogd-toestemming wordt geverifieerd.
- Bewaartermijnen, export/verwijderen, back-ups en incidentprocedure.
- Of begeleiders zelf ook een conflictregel krijgen wanneer zij aan meerdere cliënten afspraken toewijzen.

Zonder deze besluiten is dit contract voorbereiding en geen productierijpe online functie.


## Uitbreiding: concrete route- en foutafspraken

Dit blijft een contract, geen werkende API. Alle routes vereisen een geverifieerde sessie, behalve login/registratie en een minimale gezondheidscontrole. De server bepaalt de rol en actuele relatie; clientvelden zijn nooit bewijs van toestemming.

| Methode | Route | Doel en autorisatie |
|---|---|---|
| GET | `/api/v1/me` | Eigen profiel en server-toegekende rol ophalen |
| PATCH | `/api/v1/me` | Alleen beperkte profielvelden aanpassen; rol en user-ID zijn niet wijzigbaar |
| GET | `/api/v1/relationships` | Alleen eigen relaties en relevante uitnodigingen bekijken |
| POST | `/api/v1/relationships/invitations` | Uitnodiging maken met eenmalige, verlopende token; server valideert de bevoegdheid |
| POST | `/api/v1/relationships/{id}/accept` | Alleen beoogde ontvanger mag een uitnodiging accepteren |
| POST | `/api/v1/relationships/{id}/revoke` | Bevoegde cliënt of beheerder trekt relatie in; direct effect op volgende aanvraag |
| GET | `/api/v1/clients/{clientId}/appointments` | Alleen de cliënt zelf of begeleider met actieve relatie |
| POST | `/api/v1/clients/{clientId}/appointments` | Zelfde relatiecontrole; server valideert tijd, toewijzing en overlap |
| PATCH | `/api/v1/clients/{clientId}/appointments/{id}` | Autorisatie en overlap opnieuw controleren |
| DELETE | `/api/v1/clients/{clientId}/appointments/{id}` | Annuleren/verwijderen volgens vastgesteld bewaarbeleid |
| GET/POST | `/api/v1/me/roster-shifts` | Begeleider beheert eigen diensten; server controleert overlap |
| GET | `/api/v1/healthz` | Minimale status zonder persoonsgegevens |

### Standaard foutcodes

| HTTP | Code | Betekenis |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Ongeldige invoer of tijdsduur |
| 401 | `UNAUTHENTICATED` | Geen geldige sessie |
| 403 | `FORBIDDEN` | Geen toestemming; onthul geen bestaan van andere cliënten |
| 404 | `NOT_FOUND` | Niet bestaand of bewust niet zichtbaar object |
| 409 | `APPOINTMENT_OVERLAP` | Database weigert een overlap |
| 409 | `RELATIONSHIP_NOT_ACTIVE` | Relatie ontbreekt of is ingetrokken |
| 409 | `INVITATION_EXPIRED` | Uitnodiging verlopen of al gebruikt |
| 429 | `RATE_LIMITED` | Te veel pogingen |
| 500 | `INTERNAL_ERROR` | Generieke fout met request-ID; geen stacktrace of SQL-details |

### Intrekking moet atomair zijn

1. Begin een transactie en vergrendel de relatie-rij.
2. Controleer actor en bevoegdheid aan de serverkant.
3. Zet de status op `revoked` en leg de tijd vast.
4. Schrijf een minimale auditgebeurtenis zonder medische details of vrije notities.
5. Commit. Elke volgende API-/RLS-controle moet de relatie weigeren, ook als de client oude gegevens cachet.
6. Annuleer cliëntafspraken niet automatisch; volg een apart vastgesteld overdrachts- en bewaarbeleid.

### Verplichte negatieve integratietests

- Anonieme gebruiker kan geen profielen, relaties, afspraken of diensten lezen of schrijven.
- Cliënt A kan geen gegevens van cliënt B lezen, wijzigen of verwijderen.
- Een gebruiker kan zichzelf niet promoveren tot begeleider, ouder, voogd of beheerder.
- Een begeleider zonder actieve relatie of na intrekking krijgt geen toegang met een oud relatie-ID.
- Toewijzing aan een begeleider zonder actieve relatie wordt server-side geweigerd.
- Twee gelijktijdige overlappende verzoeken voor dezelfde cliënt of begeleider slaan maximaal één keer op.
- Aansluitende intervallen zijn toegestaan; geannuleerde afspraken blokkeren geen nieuwe afspraak.
- Geen service-role-sleutel in clientbundel, APK/AAB, logs of Git-history.
- Accountverwijdering, export, bewaartermijnen en ouder-/voogdetoestemming zijn getest voordat echte cliëntgegevens worden gebruikt.

## Releasepoort

Geen productiegebruik met echte cliëntgegevens totdat de identity-provider, database, concrete RLS-policies, transacties, privacy-/bewaarbeleid en Android-telefoon- en tabletacceptatietests zijn geïmplementeerd en geverifieerd.


## Lokaal starten en veilig controleren

De scaffold kan lokaal worden gestart met `npm run serve:plansamen-api`. Standaard luistert deze alleen op `127.0.0.1` en poort `4179`; stel desgewenst `PORT` in op een geldige poort tussen 1 en 65535. De server accepteert geen persoonsgegevens en is niet bedoeld voor publieke hosting. Controleer met `curl -i http://127.0.0.1:4179/api/v1/healthz`; de status moet expliciet `backendConfigured: false` en `acceptsPersonalData: false` melden. Alle andere API-routes horen `503 BACKEND_NOT_CONFIGURED` terug te geven. Dit startscript voegt geen authenticatie of database toe.
