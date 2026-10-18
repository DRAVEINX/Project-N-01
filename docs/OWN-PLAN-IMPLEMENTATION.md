# NovaLife — eigen plan en implementatiestatus

Dit document is de werkende checklist voor de functies die eerder voor NovaLife zijn afgesproken. Een functie wordt pas als **afgerond** gemarkeerd wanneer de code, regressietests en passende platformcontroles dit ondersteunen. Een groene build alleen bewijst geen werking op een echt toestel.

## Hoofdindeling en basisfuncties

- [x] Bestaande app behouden met Home, Dag, Gevoel en Meer als uitgangspunt.
- [x] Agenda met dag-, week- en maandweergave, afspraken en conflictcontrole.
- [x] Weekplanning, routines en afvinkbare taken met voortgang.
- [x] Stappenplannen/handleidingen met afbeeldingen en audio.
- [x] Gevoelscheck-ins, dagboek, tekeningen en audio-opnames.
- [x] Begeleidersrooster met namen, rollen, foto's en diensten.
- [x] Persoonlijke doelen, documenten, vertrouwde contacten en hulpacties.
- [x] Zoekfunctie, versleutelde lokale kluis, export/import en herstelbestand.
- [x] Grotere tekst, hoog contrast, minder beweging, semantische labels en toetsenbordondersteuning.
- [ ] Volledige TalkBack- en toegankelijkheidstest op echte Android-telefoon en -tablet.
- [ ] Regressiecontrole van alle bestaande schermen en functies na iedere uitbreiding.

## NovaLife-uitbreidingen uit het eigen plan

| Functie | Status | Wat nog nodig is |
|---|---|---|
| Command Center | Gedeeltelijk | Eén overzicht met de dag, volgende activiteit, taken, gevoel en maximaal vier snelkoppelingen. |
| Smart Assistant | In uitvoering | Praktische lokale suggesties en een profielgebonden dagelijkse prioriteit zijn toegevoegd; de gebruiker bewaart of wist die zelf. Dit is geen externe generatieve AI-dienst. | Lokale, voorspelbare dagsuggesties zijn toegevoegd; echte gebruiks- en toegankelijkheidscontrole blijft nodig. |
| Life Goals & Milestones | In uitvoering | Mijlpalen toevoegen/afvinken en statusgeschiedenis zijn toegevoegd; regressietests en handmatige gebruikscontrole nog uitvoeren. |
| My Life Timeline | In uitvoering | Tijdlijn met categorie-, datumbereik- en tekstfilters op titel/categorie/details is toegevoegd; regressietests staan erbij, schermvalidatie blijft open. |
| Personal Studio | In uitvoering | Keuze voor Nova-paars, Oceaanblauw, Roze en Smaragdgroen is toegevoegd; contrast, alle schermen en voorkeurbehoud nog valideren. |
| Private Vault | Gedeeltelijk | Lokale AES-GCM-kluis en back-up bestaan; resterende oude routinevoortgang en toegankelijkheidsvoorkeuren veilig migreren en testen. |
| NovaFlow-automatisering | In uitvoering | Handmatig startbare, profielgebonden snelkoppelingen naar weekplanning, agenda, gevoelscheck of assistent zijn toegevoegd; uitschakelen, verwijderen en auditlog zijn beschikbaar. Achtergrondregels en externe acties zijn bewust niet actief; echte platformautomatisering en handmatige schermvalidatie blijven open. |
| Offline Mode & Sync Center | Gedeeltelijk | Offline lokale gegevens bestaan; echte accountgekoppelde synchronisatie, conflictkeuze per item en herstelgedrag valideren. |
| NovaInsights | In uitvoering | Opt-in tellingen over stemming, routine-afronding en doelen/mijlpalen zijn toegevoegd; regressietests en handmatige privacy-/schermvalidatie blijven nodig. |
| Health Check | In uitvoering | Een lokale statuspagina voor kluis, opslag, verbinding, meldingsondersteuning en toegankelijkheidsinstellingen is toegevoegd; echte apparaten en schermlezers nog handmatig valideren. |

## Account-, privacy- en platformwerk

- [ ] Beveiligde accounts en serverdeployment daadwerkelijk configureren en testen; broncode alleen is niet genoeg.
- [ ] Begeleider-/ouder-/voogd-uitnodigingen en intrekbare rechten tussen afzonderlijke accounts veilig laten werken.
- [ ] End-to-end-versleutelde synchronisatie testen met twee apparaten en conflicten door de gebruiker laten oplossen.
- [ ] Achtergrondmeldingen op Android native testen; browsermeldingen werken niet gegarandeerd als de app gesloten is.
- [ ] Android-telefoon en Android-tablet als afzonderlijke varianten behouden en beide testen.
- [ ] Windows MSI installeren, starten, upgraden en verwijderen op een echte Windows-machine.
- [ ] iOS blijft voorlopig buiten scope, volgens de huidige opdracht.
- [ ] Onafhankelijke beveiligings- en privacybeoordeling vóór gebruik met gevoelige echte gegevens.

## Werkafspraken

1. Werk op `feature/novalife-rebrand`; overschrijf `main` niet.
2. Behoud bestaande functies en gegevens; wijzig schema's of versleuteling alleen met migratie- en hersteltests.
3. Voeg per onderdeel regressietests toe en wacht op de relevante GitHub Actions.
4. Houd onderscheid tussen aanwezig in code, geautomatiseerd getest en handmatig getest op apparaten.
5. Publiceer geen productieclaim voor niet-getekende builds, niet-geteste platformen of nog niet gedeployde serverfuncties.
