# NovaLife — eigen platform, geen verplichte externe portalen

Status: productbesluit en technische grensafbakening.

## Productbesluit
NovaLife wordt als eigen zorg- en leefplatform ontwikkeld. Caren en Nedap Ons mogen hooguit helpen om functionele behoeften te herkennen, maar zijn geen onderdelen die gebruikers vanuit NovaLife moeten openen. De NovaLife-interface bevat geen externe links of knoppen naar die portalen als vervanging voor native functionaliteit. Kopieer geen logo's, schermen, teksten of propriëtaire code.

## Eigen functionaliteit bouwen
NovaLife ontwikkelt eigen modules voor:
- cliëntprofiel, persoonlijke verhaalpagina en agenda;
- zorgplan, doelen, rapportages, evaluaties en overdrachten;
- documentenregister en later beveiligde bestandsopslag;
- zorgnetwerk, uitnodigingen, rollen en toestemmingen;
- medewerkerprofielen, roosters, beschikbaarheid, taken en meldingen;
- berichten en bijlagen via een eigen beveiligde backend;
- auditlog, gegevens-export, intrekken van toegang en accountbeheer.

## Huidige technische status
De bestaande module is een browsergebaseerd prototype met een versleutelde lokale kluis. Dit levert geen serveridentiteit, multi-user autorisatie, centrale toegang door medewerkers of betrouwbare synchronisatie tussen apparaten. Lokale berichten zijn notities en zijn niet daadwerkelijk verzonden. Het documentenregister bewaart momenteel metadata, geen documentbestanden. Medicatiegegevens zijn een persoonlijk overzicht en geen officieel toedienregistratiesysteem.

## Backend die nodig is voor echte samenwerking
Voordat NovaLife gedeelde zorgdossiers, echte berichten, accounts of uitnodigingen aanbiedt, moet een backend minimaal leveren:
- geverifieerde gebruikersidentiteit en herstelproces;
- rollen, organisatie-/profielisolatie en server-side toegangscontrole;
- expliciete toestemming per datacategorie en effectieve intrekking;
- versleuteling tijdens transport en opslag;
- auditlog voor lezen, wijzigen, exporteren en verwijderen van gevoelige gegevens;
- veilige bestandsopslag, beperkte downloadlinks, malwarecontrole en retentiebeleid;
- back-up, herstel, monitoring en incidentafhandeling;
- privacy- en beveiligingstoetsing met synthetische testgegevens.

## Integraties
Een directe Caren- of Nedap Ons-koppeling is niet onderdeel van de huidige productrichting. Als die ooit apart gewenst is, is een expliciet besluit nodig, gevolgd door officiële documentatie, toestemming van de betrokken organisatie, goedgekeurde toegang en beveiligde server-side implementatie. Geen scraping, geen wachtwoorden van andere diensten verzamelen en geen niet-geverifieerde claims over synchronisatie.

## Leveringsgates
1. Werk eigen NovaLife-UI en lokale functies af zonder bestaande functies te breken.
2. Voeg tests toe voor validatie, profielisolatie, bewerken/verwijderen, export en audit.
3. Ontwerp en bouw backendidentiteit en autorisatie voordat multi-user functies worden geactiveerd.
4. Voer beveiligings-, privacy-, toegankelijkheids- en regressietests uit.
5. Meld een release alleen als geslaagd wanneer de bijbehorende CI en doelapparaten daadwerkelijk zijn gecontroleerd.
