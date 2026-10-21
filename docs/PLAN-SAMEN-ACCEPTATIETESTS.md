# PlanSamen — acceptatietests voor toegankelijke planning

Deze testset beschrijft zowel de uitvoerbare prototypecontroles als de vereisten voor een latere online versie. De huidige prototypeversie gebruikt lokale gegevens. Tests voor echte accounts, online synchronisatie en databasebeveiliging kunnen pas slagen wanneer de afzonderlijke backend is gebouwd. Zie ook [PLAN-SAMEN-API-CONTRACT.md](./PLAN-SAMEN-API-CONTRACT.md).

## A. Huidig prototype

| ID | Test | Verwacht resultaat |
|---|---|---|
| UI-01 | Open de app op een smal telefoonscherm | Geen horizontale pagina-overloop; belangrijke knoppen blijven bereikbaar. |
| UI-02 | Open de app op tabletbreedte | De planning gebruikt de beschikbare ruimte en blijft leesbaar. |
| UI-03 | Navigeer met het toetsenbord | Bedienbare onderdelen krijgen zichtbare focus en de focusvolgorde is logisch. |
| UI-04 | Voeg een afspraak met pictogram toe en open die opnieuw | Het gekozen pictogram blijft zichtbaar; elke pictogramkeuze heeft ook een tekstlabel. |
| UI-05 | Navigeer op het startgedeelte naar cliënt- en begeleiderknoppen | Beide grote knoppen zijn bereikbaar; de interface suggereert niet dat er al aparte accounts zijn. |
| UI-06 | Open het startgedeelte op telefoon en tablet | Knoppen staan naast elkaar op brede schermen en onder elkaar op smalle schermen; geen horizontale overloop. |
| CAL-01 | Voeg een afspraak toe van 10:00 tot 10:30 | De afspraak wordt opgeslagen. |
| CAL-02 | Voeg voor hetzelfde profiel een afspraak toe van 10:15 tot 10:45 | Opslaan wordt geblokkeerd met een begrijpelijke conflictmelding. |
| CAL-03 | Voeg voor hetzelfde profiel een afspraak toe van 10:30 tot 11:00 | Toegestaan: aansluitende afspraken zonder buffer overlappen niet. |
| CAL-04 | Gebruik een eindtijd gelijk aan of eerder dan de begintijd | De afspraak wordt geweigerd met een begrijpelijke melding. |
| CAL-05 | Kies 0, 5, 10, 15 of 30 minuten vrije ruimte na afloop | De keuze wordt bij de afspraak opgeslagen en in de agenda getoond. |
| CAL-06 | Plan een afspraak vóór het einde van een bestaande afspraakbuffer | Opslaan wordt geblokkeerd; precies op het einde van de buffer kan de volgende afspraak beginnen. |
| CAL-07 | Laat een buffer na middernacht doorlopen | Een afspraak op de volgende dag wordt tot het buffereinde geblokkeerd, maar niet langer. |
| CAL-08 | Maak een weekreeks en open zowel de hoofdafspraak als een losse reeksafspraak | De agenda geeft aan of de hele reeks of alleen één afspraak wordt bewerkt. |
| CAL-09 | Verwijder de hoofdafspraak van een weekreeks of een losse reeksafspraak | De bevestiging vermeldt expliciet of de hele reeks of alleen die afspraak wordt verwijderd. |
| CAL-10 | Wijs een begeleider toe aan een afspraak en open die opnieuw | De naam van de begeleider verschijnt bij de afspraak. |
| CAL-11 | Test overlappende afspraken die dezelfde begeleidersidentiteit delen | De overlap wordt geblokkeerd, ook als de afspraken aan verschillende profielen zijn gekoppeld. |
| ROSTER-01 | Plan twee overlappende diensten voor dezelfde begeleider op dezelfde datum | De tweede dienst wordt geweigerd met een begrijpelijke melding. |
| ROSTER-02 | Plan aansluitende diensten of diensten van verschillende begeleiders | Beide diensten zijn toegestaan. |
| ROSTER-03 | Verwijder een begeleider die aan afspraken gekoppeld is | Na bevestiging blijven de afspraken bestaan, wordt de koppeling verwijderd en verdwijnen de diensten van die begeleider. |
| ROSTER-04 | Probeer een begeleider te verwijderen bij gekoppelde gegevens zonder wijzigtoestemming | De actie wordt geweigerd zonder de gekoppelde gegevens te wijzigen. |
| ACC-01 | Vergrendel de kluis en probeer privégegevens te openen | Gegevens blijven afgeschermd tot de juiste wachtzin wordt ingevoerd. |

## B. Verplicht vóór een online pilot

| ID | Test | Verwacht resultaat |
|---|---|---|
| AUTH-01 | Cliënt A probeert cliënt B te openen | Toegang wordt geweigerd; er worden geen gegevens van B teruggegeven. |
| AUTH-02 | Een niet-gekoppelde begeleider probeert een cliënt te openen | Toegang wordt geweigerd. |
| AUTH-03 | Een cliënt probeert via een profielverzoek de eigen rol te verhogen | De server weigert de rolwijziging. |
| AUTH-04 | Een cliënt trekt de toegang van een begeleider in | Nieuwe verzoeken van die begeleider worden geweigerd. |
| SYNC-01 | Maak een afspraak op een telefoon en open de agenda op een tablet | De afspraak verschijnt na succesvolle beveiligde synchronisatie. |
| SYNC-02 | Twee apparaten wijzigen niet-overlappende afspraken tegelijk | Beide wijzigingen blijven behouden. |
| CONFLICT-01 | Twee gelijktijdige verzoeken maken overlappende afspraken voor dezelfde cliënt | Maximaal één transactie slaagt; de andere krijgt een conflictmelding. |
| CONFLICT-02 | Afspraak A eindigt om 10:30 en afspraak B begint om 10:30 zonder buffer | Beide afspraken kunnen bestaan. |
| CONFLICT-03 | Twee afspraken overlappen voor dezelfde toegewezen begeleider | Opslaan wordt geblokkeerd als het productbeleid bepaalt dat de begeleider niet tegelijk beschikbaar kan zijn. |
| PRIV-01 | Controleer databasepolicies voor iedere blootgestelde tabel | RLS en policies beperken toegang op basis van eigenaarschap en geldige relatie. |
| PRIV-02 | Controleer Android-bundel en repository op geheime serverkeys | Geen service-role- of andere geheime backend-sleutels in de client of gitgeschiedenis. |

## C. Handmatige toegankelijkheidscontrole

- Test met TalkBack: labels worden uitgesproken, de focusvolgorde is logisch en pictogrammen hebben tekstlabels.
- Test tekstvergroting: titel, datum, tijd en conflictmelding blijven volledig leesbaar.
- Controleer contrast, voldoende grote aanraakdoelen en foutmeldingen in eenvoudige taal.
- Laat cliënten en begeleiders de belangrijkste taken uitvoeren zonder uitleg van de ontwikkelaar.
- Controleer dat de cliënt- en begeleiderknop in het prototype nog dezelfde lokale omgeving openen en dat nergens wordt gesuggereerd dat er al aparte online accounts bestaan.
- Test offline, bij een wegvallende verbinding en na opnieuw openen; meldingen moeten duidelijk maken of een afspraak daadwerkelijk is opgeslagen.

## Go/no-go

Geen openbare of echte cliëntpilot voordat de backendtests in deel B zijn uitgevoerd op een afzonderlijke PlanSamen-testomgeving, privacy- en bewaartermijnen zijn vastgesteld, en telefoon- én tabletbuilds zijn gecontroleerd. Een groene UI-test alleen bewijst niet dat accounts, synchronisatie of serverbeveiliging werken.
