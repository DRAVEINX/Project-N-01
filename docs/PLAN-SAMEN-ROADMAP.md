# PlanSamen — ontwikkelplan

## Productdoel
Een toegankelijke planningsapp voor Android-telefoons en tablets waarmee cliënten en begeleiders samen afspraken kunnen plannen. De interface moet rustig, voorspelbaar en bruikbaar zijn met pictogrammen, duidelijke taal, grote aanraakdoelen, schermlezers en instelbare tekstgrootte.

## Werk in deze eerste ontwikkelstap
- Productnaam ingesteld op PlanSamen in de appweergave en Android-appconfiguratie.
- Telefoon- en tabletvarianten blijven afzonderlijke installeerbare pakketten.
- Overlappende afspraken worden nu geweigerd in plaats van via een bevestigingsvenster alsnog opgeslagen te kunnen worden.
- Exacte dubbele begintijden blijven geblokkeerd.
- Afspraken hebben nu een keuze uit grote, herkenbare pictogrammen; het gekozen pictogram wordt bij de afspraak getoond.
- De pictogramkeuze heeft toetsenbordfocus-styling en een responsive indeling voor telefoon en tablet.
- GitHub CI: smoke tests, JavaScript-syntaxiscontrole, projectbestandscontrole en webprototypepakket zijn geslaagd in run 682. Dit is een eerdere geslaagde codecontrole; latere documentatiecommits zijn niet daarmee getest.
- De backend-architectuur is beschreven in [PLAN-SAMEN-BACKEND-ONTWERP.md](./PLAN-SAMEN-BACKEND-ONTWERP.md).
- De uitvoerbare prototype- en toekomstige backendacceptatiecriteria staan in [PLAN-SAMEN-ACCEPTATIETESTS.md](./PLAN-SAMEN-ACCEPTATIETESTS.md).\n- Het voorgestelde endpoint-, autorisatie- en foutcodecontract staat in [PLAN-SAMEN-API-CONTRACT.md](./PLAN-SAMEN-API-CONTRACT.md).
- Bestaande app-onderdelen blijven behouden; PlanSamen wordt op een aparte featurebranch ontwikkeld.

## Verplichte vervolgstappen
1. Maak een afzonderlijk, toegankelijk startscherm voor cliënt en begeleider, met eenvoudige taal en grote pictogramknoppen.
2. Bouw echte accounts en rolgebaseerde autorisatie. De huidige lokale profielen zijn geen afzonderlijke accounts en geven geen veilige toegang tussen apparaten.
3. Voeg een beveiligde backend en gedeelde agenda toe, met toestemming en auditregistratie voor wijzigingen door begeleiding.
4. Controleer conflicten server-side binnen één atomaire database-transactie, zodat twee gelijktijdige gebruikers niet allebei conflicterende afspraken kunnen opslaan. De clientcontrole alleen is daarvoor niet voldoende.
5. Voeg terugkerende afspraken, uitzonderingen, reistijd/buffertijd en begrijpelijke conflictmeldingen toe.
6. Test met cliënten en begeleiders, waaronder mensen die pictogrammen, schermlezers of grotere tekst gebruiken.
7. Voer tests uit op echte Android-telefoons en tablets en controleer afzonderlijke APK/AAB-builds voordat een release wordt gedeeld.

## Eerlijke status
Dit is een ontwikkelstart op basis van de bestaande toegankelijke web/Capacitor-prototype. De huidige versie heeft nog geen echte online accounts of gedeelde synchronisatie. De app is niet productierijp en mag nog niet worden gebruikt voor echte gevoelige cliëntgegevens totdat authenticatie, server-side conflictcontrole, privacy- en beveiligingstesten zijn afgerond. De nieuwe documentatie is vastgelegd, maar voor de laatste documentatiecommits is nog geen groene CI-status bevestigd. Er zijn in deze stap geen APK- of AAB-bestanden gebouwd.
