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
