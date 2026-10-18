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
| Smart Assistant | Open | Privé, voorspelbare suggesties uit lokale gegevens; geen medische claims en geen automatische externe gegevensdeling. |
| Life Goals & Milestones | Gedeeltelijk | Doelen bestaan; mijlpalen, voortgangsgeschiedenis en viering van behaalde stappen toevoegen. |
| My Life Timeline | In uitvoering | Tijdlijn van bestaande afspraken, gevoelens, dagboekmomenten, doelen en activiteiten; daarna datafiltering en gedrag testen. |
| Personal Studio | Gedeeltelijk | Thema's Nova-paars, Oceaanblauw, Roze en Smaragdgroen bestaan; contrast, alle schermen en voorkeurbehoud testen. |
| Private Vault | Gedeeltelijk | Lokale AES-GCM-kluis en back-up bestaan; resterende oude routinevoortgang en toegankelijkheidsvoorkeuren veilig migreren en testen. |
| NovaFlow-automatisering | Open | Door gebruiker ingestelde regels, bevestiging, herroepbaarheid en controleerbare acties toevoegen. |
| Offline Mode & Sync Center | Gedeeltelijk | Offline lokale gegevens bestaan; echte accountgekoppelde synchronisatie, conflictkeuze per item en herstelgedrag valideren. |
| NovaInsights | Open | Begrijpelijke trends voor stemming, routines en doelen; opt-in, privé en zonder diagnose of onbewezen conclusies. |
| Health Check | Gedeeltelijk | App-/gegevensstatus bestaat op onderdelen; een begrijpelijke controle voor back-up, opslag, synchronisatie, meldingen en toegankelijkheid toevoegen. |

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
