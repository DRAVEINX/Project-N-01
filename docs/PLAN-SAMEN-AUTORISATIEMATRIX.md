# PlanSamen autorisatiematrix

Status: ontwerp en reviewchecklist. Dit document voert zelf geen beveiliging uit en bewijst niet dat een backend bestaat.

## Principes

- Weiger standaard: geen geldige sessie of geen expliciete toestemming betekent geen toegang.
- Rollen worden alleen via een vertrouwde beheer-/uitnodigingsflow toegekend; nooit uit vrije invoer van de mobiele app.
- Controleer bij iedere serveraanvraag zowel de actor als de actuele relatie tot de betreffende cliënt.
- Gebruik ondoorzichtige foutmeldingen wanneer een object niet zichtbaar is, zodat cliëntgegevens niet via ID's kunnen worden ontdekt.
- Een ingetrokken relatie moet direct nieuwe toegang blokkeren; vertrouw niet op eerder opgehaalde clientdata als actuele autorisatie.
- Houd cliëntnotities en agenda-inhoud uit logs. Log alleen noodzakelijke auditmetadata.
- Gebruik een apart PlanSamen-project. Voer deze ontwerpen nooit uit op NovaLife.

## Matrix

| Actie | Anoniem | Cliënt zelf | Begeleider met actieve relatie | Begeleider zonder relatie | Ouder/voogd | Beheerder |
|---|---|---|---|---|---|---|
| Eigen profiel lezen | Weigeren | Toestaan | Toestaan | Toestaan | Toestaan | Alleen via expliciete beheerfunctie |
| Eigen veilige profielvelden wijzigen | Weigeren | Toestaan | Toestaan | Toestaan | Toestaan | Alleen via expliciete beheerfunctie |
| Eigen rol wijzigen | Weigeren | Weigeren | Weigeren | Weigeren | Weigeren | Alleen vertrouwde serverflow met audit |
| Cliëntagenda lezen | Weigeren | Eigen agenda | Alleen gekoppelde cliëntagenda | Weigeren | Alleen na geverifieerde toestemming en actieve relatie | Alleen noodzakelijke supportflow, geaudit |
| Afspraak maken/wijzigen | Weigeren | Eigen agenda | Alleen gekoppelde cliënt en toegestane acties | Weigeren | Alleen binnen geverifieerde bevoegdheid | Niet standaard; expliciete beheerflow |
| Relatie intrekken | Weigeren | Eigen relatie, volgens productbeleid | Eigen relatie, volgens productbeleid | Weigeren | Eigen geverifieerde relatie | Alleen beheerflow met audit |
| Alle cliënten doorzoeken | Weigeren | Weigeren | Weigeren | Weigeren | Weigeren | Alleen indien expliciet noodzakelijk en geaudit |

Deze matrix is een startpunt voor implementatie. Ouder-/voogdbevoegdheden en beheerrechten moeten vóór productie door productverantwoordelijke en privacy-/veiligheidsreview worden vastgesteld. De app mag niet zelf aannemen dat iemand ouder of voogd is.

## Testmatrix vóór livegang

1. Anonieme aanvragen voor profiel, relaties en afspraken leveren geen cliëntgegevens op.
2. Cliënt A kan geen gegevens van cliënt B lezen of wijzigen, ook niet met een bekend of aangepast object-ID.
3. Een begeleider ziet uitsluitend cliënten met een actieve relatie.
4. Na intrekken van een relatie worden nieuwe verzoeken geweigerd, ook met een nog geldige login-sessie.
5. Een cliënt kan rol, maker-ID of cliënt-ID niet vervalsen om rechten te krijgen.
6. Ouder-/voogdtoegang blijft geweigerd totdat identiteit, bevoegdheid en relatie door een vertrouwde flow zijn geverifieerd.
7. Beheeracties zijn expliciet beperkt en leveren een auditgebeurtenis op.
8. Foutmeldingen, logs en responses bevatten geen wachtwoorden, tokens, geheime sleutels of onnodige afspraaknotities.
9. Alle toegestane en geweigerde paden worden met integratietests op de echte gekozen backend getest; statische tests alleen zijn onvoldoende.
10. De database blokkeert overlappende afspraken ook wanneer twee verzoeken gelijktijdig worden verwerkt.

## Voorwaarde voor backendbouw

Kies en autoriseer eerst een afzonderlijke PlanSamen-hosting- en identity-provider. Daarna moeten concrete databasepolicies, serverhandlers en integratietests worden toegevoegd. Een schema- of documentbestand alleen maakt geen beveiligde accounts of gedeelde agenda beschikbaar.
