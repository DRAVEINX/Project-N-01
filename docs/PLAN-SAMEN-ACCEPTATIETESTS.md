# PlanSamen — acceptatietests voor gedeelde planning

Deze testset is een voorbereidingsdocument. De huidige prototypeversie gebruikt lokale gegevens; tests voor accounts, online synchronisatie en databasebeveiliging kunnen pas slagen wanneer de aparte backend bestaat.

## A. Huidige prototype (uitvoerbaar zodra de webtests draaien)

| ID | Test | Verwacht resultaat |
|---|---|---|
| UI-01 | Open de app op een smal telefoonscherm | Geen horizontale pagina-overloop; knoppen blijven bereikbaar |
| UI-02 | Open de app op een tabletbreedte | De agenda gebruikt de beschikbare ruimte en blijft goed leesbaar |
| UI-03 | Navigeer met toetsenbord | Alle bedienbare onderdelen krijgen zichtbare focus |
| UI-04 | Voeg een afspraak toe met pictogram | Het gekozen pictogram blijft zichtbaar na opslaan en opnieuw openen |\n| UI-05 | Open het startscherm en navigeer met toetsenbord naar cliënt/begeleider | Beide grote knoppen zijn bereikbaar met zichtbare focus; de melding maakt duidelijk dat dit nog geen aparte accounts zijn |\n| UI-06 | Open het startscherm op telefoon en tablet | Knoppen staan naast elkaar op brede schermen en onder elkaar op smalle schermen; geen horizontale overloop |
| CAL-01 | Voeg een afspraak toe van 10:00 tot 10:30 | Afspraak wordt opgeslagen |
| CAL-02 | Voeg een afspraak toe van 10:15 tot 10:45 voor dezelfde cliënt | Opslaan wordt geblokkeerd met een begrijpelijke melding |
| CAL-03 | Voeg een afspraak toe van 10:30 tot 11:00 | Toegestaan: afspraken die elkaar exact raken overlappen niet |
| CAL-04 | Probeer een eindtijd gelijk aan of eerder dan de begintijd | Afspraak wordt geweigerd |
| ACC-01 | Vergrendel de kluis en probeer privégegevens te openen | Gegevens blijven afgeschermd tot de juiste wachtzin is ingevoerd |

## B. Vereist vóór online pilot (backend nog niet aangesloten)

| ID | Test | Verwacht resultaat |
|---|---|---|
| AUTH-01 | Cliënt A probeert cliënt B te openen | Toegang geweigerd; geen gegevens van B teruggegeven |
| AUTH-02 | Ongekoppelde begeleider probeert cliënt A te openen | Toegang geweigerd |
| AUTH-03 | Cliënt probeert de eigen rol in een profielverzoek te veranderen naar begeleider | Verzoek geweigerd door serverbeleid |
| AUTH-04 | Cliënt trekt toegang van een begeleider in | Toekomstige verzoeken van die begeleider worden geweigerd |
| SYNC-01 | Cliënt maakt afspraak op telefoon en opent tablet | De afspraak verschijnt na succesvolle synchronisatie |
| SYNC-02 | Twee apparaten wijzigen niet-overlappende afspraken tegelijk | Beide wijzigingen blijven behouden |
| CONFLICT-01 | Twee gelijktijdige verzoeken maken overlappende afspraken voor dezelfde cliënt | Maximaal één transactie slaagt; de andere krijgt een conflictmelding |
| CONFLICT-02 | Afspraak A eindigt om 10:30 en afspraak B begint om 10:30 | Beide kunnen bestaan |
| CONFLICT-03 | Twee afspraken overlappen voor dezelfde toegewezen begeleider | Opslaan wordt geblokkeerd als de productregel zegt dat een begeleider niet tegelijk beschikbaar kan zijn |
| PRIV-01 | Bekijk databasepolicies voor iedere exposed tabel | RLS actief en policies beperken toegang op basis van eigenaarschap/actieve relatie |
| PRIV-02 | Controleer de Android-bundel en repository op geheime serverkeys | Geen service-role- of geheime backend-sleutels in de client of gitgeschiedenis |

## C. Handmatige toegankelijkheidscontrole

- Test met TalkBack: labels worden uitgesproken, focusvolgorde is logisch en pictogrammen hebben tekstlabels.
- Test tekstvergroting: titel, datum, tijd en conflictmelding blijven volledig leesbaar.
- Controleer contrast, grote aanraakdoelen en foutmeldingen in eenvoudige taal.
- Laat cliënten en begeleiders de belangrijkste taken uitvoeren zonder uitleg van de ontwikkelaar.\n- Controleer dat de cliënt- en begeleiderknop in het huidige prototype nog dezelfde lokale omgeving openen en nergens wordt gesuggereerd dat er al aparte online accounts bestaan.
- Test offline, bij wegvallende verbinding en na opnieuw aanmelden; meldingen moeten duidelijk maken of een afspraak daadwerkelijk is opgeslagen.

## Go/no-go

Geen openbare of echte cliëntpilot voordat alle tests in B zijn uitgevoerd op een afzonderlijke PlanSamen-testomgeving, privacy- en bewaartermijnen zijn vastgesteld, en telefoon- én tabletbuilds zijn gecontroleerd. Een groene UI-test alleen bewijst niet dat accounts, synchronisatie of serverbeveiliging werken.
