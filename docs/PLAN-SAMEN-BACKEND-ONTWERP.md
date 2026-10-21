# PlanSamen backend ontwerp

Status: ontwerp; nog niet gekoppeld aan een database of productieomgeving. De PostgreSQL-referentiestructuur staat in [`backend/plansamen/reference-schema.sql`](../backend/plansamen/reference-schema.sql); dit is nadrukkelijk geen uitgerolde migratie en heeft nog geen toegangsbeleid.

## Doel

PlanSamen moet afspraken veilig delen tussen cliënten en hun begeleiders, zonder gegevens van andere cliënten zichtbaar te maken. Dit ontwerp is bedoeld voor een **eigen, afzonderlijke backend voor PlanSamen**. Het bestaande NovaLife-project is geen onderdeel van deze app en mag hiervoor niet worden gebruikt.

## Gegevensmodel

- **Profielen**: één profiel per ingelogde gebruiker, gekoppeld aan de provider-auth-ID. De rol wordt door een vertrouwde beheer-/uitnodigingsflow toegekend; niet door vrij bewerkbare profielmetadata.
- **Cliënt-begeleiderrelaties**: expliciete koppeling tussen cliënt en begeleider, met status (uitnodiging/open, actief, ingetrokken) en auditvelden.
- **Afspraken**: cliënt-ID, maker-ID, optionele toegewezen begeleider-ID, titel, begin- en eindtijd met tijdzone, pictogram, notitie, status en aanmaak-/wijzigingsdatum.
- **Auditlog**: minimale registratie van beveiligingsrelevante acties, zonder onnodige gevoelige notitie-inhoud.

## Toegangsregels

1. Een cliënt mag alleen afspraken lezen en wijzigen die bij het eigen cliëntprofiel horen.
2. Een begeleider mag alleen afspraken lezen en wijzigen voor cliënten met een actieve relatie.
3. Een cliënt kan niet zelf een begeleiderrelatie activeren of een accountrol naar begeleider veranderen.
4. Iedere tabel in een publiek bereik krijgt Row Level Security (RLS) en expliciete policies. Een ingelogde gebruiker alleen is niet voldoende: elke policy controleert ook de relatie/het eigenaarschap.
5. Er komen geen service-role- of geheime sleutels in de Android-app.
6. Ingetrokken relaties blokkeren toekomstige toegang; verwijdering en bewaartermijnen worden vóór productie vastgelegd.

## Geen dubbele afspraken: database als laatste controle

Een controle in de app is handig voor directe feedback, maar kan gelijktijdige wijzigingen niet betrouwbaar tegenhouden. De database moet de definitieve controle uitvoeren binnen één transactie.

- Gebruik halfopen tijdsintervallen `[start, einde)`, zodat een afspraak die om 10:00 eindigt naast een afspraak die om 10:00 begint kan bestaan.
- Valideer dat `einde > start` en dat de opgegeven tijden geldig zijn.
- Dwing overlapvrijheid af op cliëntniveau met een PostgreSQL exclusion constraint op cliënt-ID en tijdsrange.
- Bepaal vóór implementatie ook het beleid voor begeleiders die meerdere cliënten tegelijk begeleiden: als een begeleider niet op twee plekken tegelijk kan zijn, is een tweede constraint nodig voor toegewezen begeleiders. Dit kan betekenen dat afspraken met meerdere begeleiders later een aparte koppeltabel nodig hebben.
- Behandel een databaseconflict als een duidelijke gebruikersmelding; sla de conflicterende afspraak niet op.

## Privacy en toegankelijkheid

- Verzamel alleen gegevens die nodig zijn voor plannen.
- Houd medische details en vrije notities optioneel en beperk de toegang daarop.
- Gebruik begrijpelijke foutmeldingen, grote bedieningselementen, pictogrammen met tekstlabels, toetsenbord-/schermlezerondersteuning en voldoende contrast.
- Leg privacyverklaring, bewaartermijnen, export en accountverwijdering vast vóór een openbare release.

## Acceptatiecriteria vóór echte accounts

- Twee testaccounts kunnen niet elkaars cliëntgegevens lezen.
- Een begeleider zonder actieve relatie krijgt geen toegang.
- Een cliënt kan geen eigen rol of relatie verhogen.
- Twee gelijktijdige verzoeken voor overlappende afspraken leveren maximaal één opgeslagen afspraak op.
- Afspraken die elkaar exact raken (bijvoorbeeld 10:00–10:30 en 10:30–11:00) zijn toegestaan.
- Ingetrokken begeleiderrelaties verliezen toegang.
- Beveiligingspolicies en overlapbeperkingen zijn getest op de daadwerkelijke aparte testdatabase.
- Android-telefoon en -tablet worden afzonderlijk getest op lay-out, TalkBack, offline-/foutmeldingen en synchronisatie.

## Huidige status

De huidige PlanSamen-branch is nog een prototype met lokale gegevens. Dit document implementeert of activeert **geen** online accounts, synchronisatie of server-side overlapbeveiliging. Daarvoor is een aparte backend nodig, met expliciete keuze van organisatie/project en controle van eventuele kosten. Voer geen databasewijzigingen uit voordat de juiste PlanSamen-omgeving is bevestigd.
