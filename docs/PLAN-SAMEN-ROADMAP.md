# PlanSamen — ontwikkelplan

## Productdoel
Een moderne, toegankelijke persoonlijke dagplanner voor Android-telefoons en tablets, uitsluitend gericht op cliënten. De interface moet rustig, voorspelbaar en bruikbaar zijn met pictogrammen, duidelijke taal, grote aanraakdoelen, schermlezers en instelbare tekstgrootte.

## In de huidige featurebranch uitgewerkt
- PlanSamen is als afzonderlijke feature ontwikkeld; bestaande apponderdelen en telefoon-/tabletvarianten worden niet vervangen.
- De startpagina is cliëntgericht; er zijn geen cliënt-/begeleiderkeuzeknoppen meer in de gebruikersinterface.
- Afspraken kunnen een herkenbaar pictogram krijgen.
- Exacte dubbele begintijden en overlappende afspraken binnen hetzelfde lokale profiel worden geblokkeerd. Afspraken die exact op elkaars eindtijd aansluiten blijven mogelijk.
- Een afspraak kan 0, 5, 10, 15 of 30 minuten vrije ruimte na afloop reserveren voor reizen of rust. De overlapcontrole houdt ook rekening met een buffer die doorloopt tot na middernacht.
- De persoonlijke agenda toont afspraken en voorkomt overlappende afspraken binnen het lokale profiel.
- Conflictmeldingen noemen de bestaande afspraak binnen hetzelfde profiel, zodat de gebruiker de botsing kan oplossen. Bij een conflict met een begeleider in een ander profiel blijven titel en andere afspraakgegevens verborgen.

- Weekreeksen zijn herkenbaar in de agenda. Het bewerken van de reeks-hoofdafspraak meldt dat alle afspraken in die reeks worden aangepast. Een losse reeksafspraak is als zodanig gemarkeerd en wijzigen ervan geldt alleen voor die afspraak.

- Verwijderen vraagt expliciete bevestiging voor het verwijderen van de hele reeks versus alleen één afspraak.
- De bediening heeft grote pictogramkeuzes, toetsenbordfocus, responsieve telefoon-/tabletstijlen en lokale, versleutelde gegevensopslag.

## Ontwerp- en testdocumenten
- Backend-architectuur: [PLAN-SAMEN-BACKEND-ONTWERP.md](./PLAN-SAMEN-BACKEND-ONTWERP.md).
- Prototype- en backendacceptatiecriteria: [PLAN-SAMEN-ACCEPTATIETESTS.md](./PLAN-SAMEN-ACCEPTATIETESTS.md).
- API-, autorisatie- en foutcodecontract: [PLAN-SAMEN-API-CONTRACT.md](./PLAN-SAMEN-API-CONTRACT.md).
- Rollen en beveiligingsgevallen: [PLAN-SAMEN-AUTORISATIEMATRIX.md](./PLAN-SAMEN-AUTORISATIEMATRIX.md).

## Volgende verplichte stappen
1. Test de persoonlijke planning met cliënten, ook met TalkBack, grote tekst en pictogrammen, en verwerk feedback.
2. Kies en autoriseer een afzonderlijke PlanSamen-hosting- en identity-provider; wijzig of hergebruik NovaLife niet.
3. Bouw echte accounts en server-side rolgebaseerde autorisatie. Lokale profielen zijn geen afzonderlijke accounts en geven geen veilige toegang tussen apparaten.
4. Voeg beveiligde online synchronisatie toe voor de eigen agenda en instellingen van de cliënt.
5. De referentie-SQL bevat ontwerpconstraints tegen overlappende afspraken per cliënt, toegewezen begeleider en overlappende roosterdiensten per begeleider. Dit is alleen ontwerpcode en is niet op een database toegepast; overlap tussen een afspraak en een dienst is nog niet afgedekt.
6. Controleer conflicten aan de serverkant binnen één atomaire databasetransactie. De clientcontrole alleen beschermt niet tegen gelijktijdige opslagen vanaf meerdere apparaten.
7. Houd de database standaard gesloten totdat policies op basis van een vertrouwde identiteit, actieve cliënt-begeleiderrelaties en afzonderlijke ouder-/voogdetoestemming zijn geïmplementeerd en negatief getest. Trek relatie-toegang server-side en direct in bij intrekking.
8. Werk uitzonderingen en het beheer van terugkerende afspraken uit voor een online gedeelde agenda.
9. Voer tests uit op echte Android-telefoons en tablets en controleer afzonderlijke APK/AAB-builds voordat een release wordt gedeeld.

## Backend-scaffold status
- De eerste Node.js API-grens staat in `backend/plansamen/server.mjs`. Alleen `GET /api/v1/healthz` geeft een minimale status; alle andere `/api/*`-routes geven `503 BACKEND_NOT_CONFIGURED` en nemen geen persoonsgegevens op in foutmeldingen.
- Er zijn automatische HTTP-tests voor weigering van profiel-, relatie-, afspraak- en roosterverzoeken en voor beveiligingsheaders. Dit is nog geen authenticatie of productiebackend.

## Eerlijke status
Dit blijft een lokale web/Capacitor-prototype. Echte online accounts, online gedeelde synchronisatie en server-side conflictcontrole zijn nog niet aangesloten. Het prototype is niet productierijp en mag nog niet worden gebruikt met echte gevoelige cliëntgegevens totdat authenticatie, serverbeveiliging, privacybeleid en relevante tests zijn afgerond. De automatische controles zijn zichtbaar bij de commits van de featurebranch. Een groene CI-run bewijst dat de gecontroleerde tests en verpakkingsstappen slagen; het bewijst niet dat de app productiegeschikt is. Er zijn in deze stap geen nieuwe APK- of AAB-bestanden gebouwd.
