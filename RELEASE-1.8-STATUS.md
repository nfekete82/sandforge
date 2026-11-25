# Sandforge 1.8

PR #497 ist offen. Der reproduzierte Ausgangsstand ist `b1af4d54`. Die 13 lokalen GLB-Änderungen liegen weiterhin im ursprünglichen Checkout.

| Prüfung | Ausgangsstand |
| --- | --- |
| Node und Simulation | 2.471 bestanden, 85 fehlgeschlagen, 3 übersprungen. Gleiche Anzahl in GitHub CI. |
| Classic-Browser | 93 von 118 bestanden. Drei GitHub-CI-Shards fehlgeschlagen. |
| WebGL-Integration | 58 von 82 bestanden. Die erweiterte Suite meldete 160 von 231 bestandene Tests. |
| Prozedurale Karten | 46 von 46 Browsertests und 1.000 generierte Geometriefälle bestanden. |
| Build, Docker, Assets und Animationen | Standard- und Classic-Build, Docker-Build und HTTP-Smoke-Test sowie Gebäude- und Animationsaudit bestanden. |
| Archivierte Atlas-Browsertests | 37 von 71 bestanden. Die Release-Relevanz wird anhand der veröffentlichten Einstiegspunkte und CI-Workflows geprüft. |

Die lokalen PBR-Quellpfade können die Build-Ausgabe abhängig vom Rechner ändern. Die Asset-Schutzprüfung für GLB und GLTF greift im PR. Weitere Fehlergruppen betreffen veraltete Assertions auf interne Namen und Modelle, KI und Navigation sowie HUD und Rendering. Die Reproduktion liegt in `/tmp/sf497-confirmed-node.log`, `/tmp/sf497-latest-classic.log`, `/tmp/sf497-latest-webgl.log`, `/tmp/sf497-latest-extended.log` und `/tmp/sf497-legacy-browser.log`.

Der vollständige Testlauf, grüne GitHub CI, Merge, Verifikation von `main` und Release-Versionierung stehen aus.

## Korrekturen seit `b1af4d54`

- GitHub meldet 21 erfolgreiche Workflows. Zwei fehlgeschlagene Workflows reproduzieren dieselben 85 Node-Fehler. Im Hauptworkflow scheitern zusätzlich 31 Classic-Browsertests über drei Shards. Die gezielten 29 Tests des KI-Lernworkflows bestehen in GitHub CI.
- Standardbuild und Docker liefern dieselben SHA-256-Prüfsummen für HQ und Kaserne. Lokale Autorenmodelle werden nur explizit gewählt. Der gültige kombinierte Quellpfad und die erneute Installation wurden lokal geprüft. Ein fehlender expliziter Pfad bricht ab und lässt die zuvor bereitgestellten Dateien bytegleich. Die finalen Autorenmodelle sind weiterhin nur lokal vorhanden. GitHub hat dafür keine Release-Assets. Die Tests auf diese Geometrie bleiben aktiv.
- Classic öffnet aus der taktischen Pause mit Escape das Menü und behält die Auswahl. Zehn gezielte Eingabe- und Spielende-Tests in Chromium bestehen.
- KI und Wirtschaft bestehen 80 gezielte Tests. Das Szenario zur Infanterieproduktion prüft die bezahlte Anschaffung vor der ersten Panzerreservierung bei unzureichender Infanteriedeckung. Der Turm-Benchmark errichtet weiterhin sechs bezahlte Türme unter 200 Simulationssekunden mit dem regulären Einkommen und dem aktuellen Turmpreis.
- Navigation besteht 14 gezielte Tests. Die physischen historischen v5-Pässe werden wieder tatsächlich geprüft. v4-Spielstände erhalten ihre Gelände- und Navigationsdaten und verwenden ihren ursprünglichen Routenpfad.
- 21 gezielte Tests für Kartenmenü, Biome, Felsgestaltung und Effekte sowie 31 gezielte Tests für WebGL-Modelle, Maßstab und HUD bestehen. Classic-Kampfregressionen prüfen den aktuellen Infanterie-Halt unter Beschuss und die Zielbindung eines stationären Trupps.
- Der europäische Atlas wird unter `/legacy/index.html` als separates Archiv ausgeliefert. Die Paketbefehle und PR-CI verwenden für Sandforge WebGL und Classic Canvas. Der HTTP-Test prüft auch die Archivroute. Die historischen Atlas-Browsertests wurden separat ausgeführt und zeigen weiterhin Fehler.

Der erste Korrekturstand `112a57cb` liegt auf PR #497. Der Git-Diff zur PR-Basis enthält keine geschützten GLB-/GLTF- oder Klippendateien.

| Prüfung nach den ersten Korrekturen | Ergebnis |
| --- | --- |
| Vollständiger Node-Lauf | 2.490 bestanden, 68 fehlgeschlagen, 3 vorhandene Skips. Darunter drei lokale Loopback-Fehler, die im gezielten Wiederholungslauf mit Serverzugriff alle bestanden. |
| Classic Canvas | 102 von 118 bestanden. Zusätzlich fünf gezielte Produktions-, Karten- und HUD-Tests und zwei Wetter- und Wiederladetests nach weiteren Fixture-Korrekturen bestanden. |
| WebGL-Integration | 61 von 82 bestanden. |
| Modellgalerie | 10 gezielte Tests bestanden. Pausierte und statische Modelle werden nur bei Änderungen neu gerendert. |
| Expliziter PBR-Autorenbuild | 20 von 20 Tests bestanden. Der Standardbuild und GitHub CI verfügen weiterhin nur über die eingecheckten Modelle. |
| Weitere gezielte Korrekturen | 18 Tests zu Fraktionsmarkierungen, 18 zur Geländeoberfläche und 5 zum WebGL-/Classic-Einstieg bestanden. |

Der Standardlauf mit Loopback-Zugriff und der erweiterte WebGL-Lauf schreiben nach `/tmp/sf18-node-full-verified.log` und `/tmp/sf18-webgl-extended.log`. Die vorherigen vollständigen Läufe liegen in `/tmp/sf18-node-full.log`, `/tmp/sf18-classic-full.log` und `/tmp/sf18-webgl-full.log`. Der Arbeitsstand liegt im isolierten Worktree `/tmp/sandforge-release-1.8`.

## Prüfstand nach `40375420`

- Die WebGL-Befehlsleiste zeigt den Sammelpunkt für ausgewählte, fertige eigene Produktionsgebäude wieder an. Das WebGL-Logo führt zur veröffentlichten Classic-Route. Sechs gezielte WebGL-Tests und fünf Einstiegstests bestehen.
- Vollständiger Standard-Node-Lauf mit Loopback-Zugriff: 2.511 bestanden, 47 fehlgeschlagen, drei vorhandene Skips. Der Lauf liegt in `/tmp/sf18-node-head-40375420.log`. Die 47 Fehler umfassen 13 Assertions auf lokal vorhandene, finale HQ-/Kasernengeometrie sowie weitere aktive Render- und historisch gewachsene Regressionen. Die Asset-Tests bleiben aktiv.
- Classic aus dem vorgesehenen Testverzeichnis: 116 von 125 bestanden. Der erweiterte WebGL-Sammellauf bestand 162 von 231 Tests. Getrennte Profile bestanden sieben Classic-Titeltests und sämtliche 61 prozeduralen WebGL-Kartentests. Der separate Meshy-Vorschaubuild verarbeitet die eingecheckte optimierte Factory-GLB. Zwei von drei separat ausgeführten Meshy-Factory-Browsertests bestanden.
- Standardbuild, Docker-Build und HTTP-Smoke für WebGL, Classic, Atlas und HQ-Asset sowie Gebäude- und Animationsaudit sind erfolgreich. Die Auditberichte prüfen 15 Gebäude-GLBs, 109 PNGs, acht lizenzierte Originalmodelle und 18 aktive Animationsatlanten.
- GitHub meldet für `40375420` 21 von 23 erfolgreichen Workflows. `Build and simulation tests` und `Sandforge Tactical AI 3.0 - learning and overrun` bleiben rot.
- Das Dateischutzmuster für GLB, GLTF und verworfene Klippenshader ist aktiv. Die 13 lokalen GLB-Änderungen im ursprünglichen Checkout bleiben erhalten. Release-Tag und Verifikation des gemergten `main` stehen weiter aus.

## Abschlussprüfung des Code-Stands `360baa56`

Im frischen Standard-Checkout bestanden 2.535 von 2.561 Node- und Simulationstests. 23 schlugen fehl und drei vorhandene Skips wurden vom Test-Runner gemeldet. Die Bytewerte der vier HQ- und Kasernenmodelle stimmen zwischen dem isolierten Standardbuild und Docker überein. Docker-Build, alle veröffentlichten HTTP-Einstiege, Gebäude- und Animationsaudit sowie der Browserstart des Atlas-Archivs waren erfolgreich.

| Offene Node-Gruppe | Anzahl | Ursache |
| --- | ---: | --- |
| Finale HQ- und Kasernen-PBR-Modelle | 13 | Der lokale Autorenbuild enthält die geprüften Binärquellen. Der Standardbuild nutzt die eingecheckten Modelle und verfehlt die Assertions auf die finale Geometrie. Der explizite Autorenbuild bestand 20 gezielte Tests. |
| Wüstengelände und Oberflächen | 8 | Abweichende Farb-, Geröll-, Polygon- und Materialassertions zwischen den früheren Szenen und den aktiven Terrain-Pfaden. |
| Strategische Gebäudemodelle | 2 | Geometrie- und Silhouettenassertions für Forschungszentrum und Silo. |

Die neun offenen Classic-Browserfälle betreffen vier HUD- und Katalogprüfungen, drei Sprite- und Canvas-Referenzen sowie zwei Sicht- und Bastionsfälle. Der vollständige Classic-Lauf wurde aus `tests/browser` wiederholt, damit alle relativen Screenshot-Pfade aufgelöst werden. Die gültigen Logs sind `/tmp/sf18-clean-final-node.log`, `/tmp/sf18-classic-complete.log`, `/tmp/sf18-clean-final-webgl.log`, `/tmp/sf18-procedural.log`, `/tmp/sf18-docker-smoke-head-360baa56.log` und `/tmp/sf18-archive-smoke.log`.

Die vollständige WebGL-Integration bestand 64 von 82 Tests. Die 18 offenen Fälle betreffen HUD und Produktion, Bauanimation und Ton, Gelände und Nebel, Bewegungseffekte und zwei Spielstartprüfungen. Die 17 Node-Vorprüfungen der WebGL-Integration und alle 61 prozeduralen Browsertests bestanden.

Die GitHub-CI für `360baa56` meldet unter Node 22 dieselben 23 Fehler, 2.535 bestandene Tests und drei vorhandene Skips. Classic-Shard 1 meldete 29 bestandene und drei fehlgeschlagene Tests. Shard 2 meldete 30 bestandene und einen fehlgeschlagenen Test. Die Hauptverzweigung steht auf `c8180d8d`. Merge, Nachprüfung des gemergten `main` und Release-Tag stehen aus. [GitHub-CI-Lauf](https://github.com/nfekete82/sandforge/actions/runs/45656617980)

## Fortsetzung ab 360baa56 am 25. November 2026

- PR #497 steht auf `360baa56`. Main steht auf `c8180d8d`.
- Zehn Node-Fehler außerhalb der PBR-Modellprüfung waren veraltete Erwartungen an den Wüstenboden, das Forschungszentrum und das Raketensilo. Die gezielte Prüfung der sieben betroffenen Testdateien besteht mit 25 von 25 Tests.
- Die geprüften PBR-Branches enthalten dieselben älteren GLB-Dateien wie der PR. Die vier finalen lokalen Dateien sind erhalten. Es wurde kein freigegebenes, versioniertes Release- oder CI-Artefakt für diese Modelle gefunden.
- Die Classic- und WebGL-Regressionen werden gegen den Standard-Build geprüft.

### Regressionen und Standardbuild

- Die WebGL-Zielmarkierung lief mit der Simulationszeit und blieb in der taktischen Pause sichtbar. Sie blendet jetzt 650 ms nach dem Klick aus. Die Browserprüfung misst die sofortige Reaktion auf den echten Rechtsklick und das Ausblenden bei pausierter Simulation.
- Die neun Classic-Regressionen betrafen kompakte HUD- und Katalogregeln, die Pixelreferenz für Fahrzeugaufhängung und Reifenzwischenphasen, HD-Atlaszuschnitte, das separate Rollenabzeichen der Infanterie, die Nebelabtastung und den heute erforderlichen Angriffsmarsch. Canvas-Pixelparität, verdeckte Gegner und Bastionskampf werden weiterhin anhand der gerenderten Szene und des tatsächlichen Spielzustands geprüft.
- Die WebGL-Browserprüfungen verwenden die realen Produktionsfreigaben und den Sektorzugriff des HUD, zusammengefasste Gelände- und Nebelgeometrie, die Boden-zu-Dach-Bauphasen der geladenen GLB, den heutigen Fraktionsfarbwert und den aktuellen Materialpfad für jedes geprüfte Modell.
- GitHub-Branches, Releases, passende Actions-Artefakte und die konfigurierten CI-Variablen und Secret-Namen haben keine freigegebene Quelle ergeben. Die Paketliste erfordert den Token-Scope `read:packages`, den der vorhandene Zugang nicht hat. Der Git-Diff gegen `main` ist frei von geschützten Asset- und Klippendateien.

| Prüfung dieses Stands | Ergebnis |
| --- | --- |
| Node und Simulation | 2.545 bestanden, 13 fehlgeschlagen, drei vorhandene Skips. Alle 13 Fehler prüfen die finalen HQ-/Kasernen-GLBs. |
| Classic-Browser | 125 von 125 bestanden. |
| Prozedurale WebGL-Karten | 61 von 61 bestanden. |
| WebGL-Integration | 82 von 82 bestanden. |
| Explizite lokale Autorenmodelle | 20 gezielte Node-Tests und zwei zusätzliche WebGL-Prüfungen bestanden. |
| Vorprüfungen der WebGL-Integration | 17 von 17 bestanden. |
| Standard- und Classic-Build | Bestanden. |
| Gebäude- und Animationsaudit | 15 GLBs, 109 PNGs, acht lizenzierte Modelle und 18 Animationsatlanten geprüft. |
| Docker-Build und HTTP-Smoke | Bestanden. Spielstart, Classic, WebGL, Atlas-Archiv und GLB-Routen liefern HTTP 200. Die vier GLBs stimmen bei lokalem Standardbuild und Docker bytegenau überein. |

Vollständige Logs dieses Stands liegen unter `/tmp/sf18-resume-node-full.log`, `/tmp/sf18-resume-classic-full.log`, `/tmp/sf18-resume-webgl-full.log`, `/tmp/sf18-resume-procedural.log`, `/tmp/sf18-resume-asset-audit.log` und `/tmp/sf18-resume-docker-smoke.log`.

### Freigabestatus

`package.json` und Lockdatei stehen auf `1.8.0`. Voraussetzung für Merge, die Verifikation von `main` und das Tag `v1.8.0` ist eine freigegebene, versionierte und für CI lesbare Quelle der vier finalen GLBs. Die Browser- und Simulationskorrekturen werden in [PR #497](https://github.com/nfekete82/sandforge/pull/497) geprüft.

### Nachprüfung auf GitHub

- Die Node-22-Jobs `Build and simulation tests` und `Sandforge Tactical AI 3.0` bestätigten 2.545 bestandene Tests und dieselben 13 GLB-Fehler. Der GitHub-Asset-Schutz bestand. [Hauptworkflow](https://github.com/nfekete82/sandforge/actions/runs/45662363681)
- Der Classic-Trace zeigte bei 620 Pixeln überstehende Katalogbeschriftungen mit der Linux-Ersatzschrift. Das Classic-Layout hält Schrift, Symbol und Textgrenzen jetzt innerhalb der Schaltflächen. Der Regressionstest misst die tatsächlichen Textflächen einschließlich einer breiteren Ersatzschrift. Die gezielten Classic-Layout- und Katalogtests bestanden mit 13 von 13 Tests.
- Der Modellgalerietest erreichte unter Software-WebGL beim Aufzeichnen der dritten Vollbildaufnahme sein altes Zeitlimit. Der Test synchronisiert den Modellwechsel und misst das tatsächliche Anhalten der Animation. Die Bild- und Videoaufzeichnung bleibt Bestandteil der Prüfung. Der gezielte Test bestand.

Der folgende Linux-Trace zeigte den größten Zeitbedarf bei den acht Orbit-Bewegungsschritten und den wiederholten Mausaktionen unter Software-WebGL. Der Galerietest prüft weiterhin eine echte Orbit-Geste, den Modellwechsel, alle fünf Clips und Wiedergabe/Pause. Er nutzt zwei Bewegungsereignisse für dieselbe Geste und Tastatureingaben für Wiedergabe und Pause. Die drei Vollbildaufnahmen und die Videoaufzeichnung bleiben Teil des Tests. Der gezielte Lauf besteht. [Classic-Shard 3](https://github.com/nfekete82/sandforge/actions/runs/45664755880/job/139383772315)

Auf dem korrigierten Classic-Stand bestanden lokal 125 Classic-Browserprüfungen, 82 WebGL-Integrationstests, 61 prozedurale Kartenprüfungen und der erneute Docker-Smoke. Der vollständige Node-Lauf mit explizit installierten lokalen Autorenmodellen bestand mit 2.558 Tests und drei vorhandenen Skips, der vollständige WebGL-Lauf mit diesen Modellen mit 82 Tests. Beide Standard-CI-Node-Jobs melden weiterhin dieselben 13 fehlenden finalen GLB-Eigenschaften. [CI-Nachprüfung](https://github.com/nfekete82/sandforge/actions/runs/45664755880)

- Der Classic-Angriffsalarm war bei langsamer CI gelegentlich noch sichtbar, weil die beteiligte Infanterie nach dem eigentlichen Testtreffer automatisch weiterkämpfte. Der Test lässt die HUD-Warnung regulär erscheinen, isoliert den ersten Treffer und prüft das Ablaufen sechs Sekunden nach diesem Treffer bei identischer Warnsequenz. Zehn gezielte Wiederholungen bestanden. [Classic-Shard 1](https://github.com/nfekete82/sandforge/actions/runs/45667305685/job/139392826359)

- Der letzte Linux-Shard zeigte, dass auch der Raketenwerfer-Galerietest unter Software-WebGL auf den zweiten GLB-Farbstand wartet. Beide Galerietests behalten das vollständige CSS-Layout, ihre Geometrie-, Animations- und Eingabeprüfungen sowie die Aufnahmen. In CI rendern sie mit einem kleineren Rasterpuffer und warten explizit auf die geladenen Fraktionsmodelle. Galerien und Angriffswarner bestanden im lokalen CI-Profil in je drei Wiederholungen. [Classic-Shard 3](https://github.com/nfekete82/sandforge/actions/runs/45667305685/job/139392825871)


## Release-Kandidat auf Basis von `07f5923e`

- WebGL unter `/` ist die unterstützte Spieloberfläche. `src/reborn` bleibt der gemeinsame Simulations-, KI- und Spielstandskern. Action und Classic bleiben unterstützte **Regelprofile** in WebGL.
- Der separate Classic-Canvas-Einstieg `/classic.html` bleibt für Archiv und Kompatibilität verfügbar. Seine vollständige Chromium-Suite ist als manuell startbarer [Archivworkflow](.github/workflows/sandforge-classic-archive.yml) erhalten. Dazu gehören die drei auf GitHub unter Software-WebGL abgelaufenen Galerietests.
- Atlas Dominion bleibt unter `/legacy/index.html` und verwendet seinen eigenen Europa-Spielkern. Der HTTP-Test prüft den Archiv-Einstieg weiterhin. Die Atlas-spezifischen Node- und Browserregressionen liegen weiterhin im Repository. `npm test` führt die vollständige Node-Sammlung aus. `npm run test:release` prüft Reborn, den WebGL-Client, die aktive KI und das Paket.
- Vier in Git versionierte GLBs unter `src/release-pbr/` sind die Quelle für HQ und Kaserne im Standardbuild. Die Modelle stammen aus dem lokal validierten Autorensatz. Fehlende Materialkarten an Lüftungen, Stahlteilen und Sandsacknähten verwenden vorhandene eingebettete PBR-Texturen. Die HQ-Modelle enthalten ergänzte und auf Einheitslänge geprüfte Normalen. Geometrie, UVs, Rig-Pivots und Modelle der Classic-Spritequelle bleiben erhalten.
- Der Action-Workflow erlaubt genau die vier SHA-256-geprüften GLBs. Änderungen an den bisherigen GLB-/GLTF-Dateien und den verworfenen Klippenpfaden bleiben gesperrt. Die gesonderte Build-Schutzprüfung kontrolliert beide Quellverzeichnisse. Der Docker-Smoke-Test vergleicht alle vier über HTTP ausgelieferten Modelle bytegenau mit Git.
- GitHub prüft den produktiven Browserpfad, prozedurale Karten, historische Saves und das Docker-Abbild zusätzlich zur Node-Suite. Der KI-Lernworkflow behält seine gezielten Tests. Der Hauptworkflow übernimmt den dort zuvor wiederholten vollständigen Node-Lauf.

Die lokale Abnahme bestand mit 2.208 produktionsrelevanten Node-Prüfungen und einem Skip für optionale lokale Premium-Infanterie. Im Browserlauf bestanden 85 der 86 WebGL-Fälle. Der übrige Start- und Spielstandstest adressierte noch das frühere freie Kartenmenü. Er wählt jetzt auf `/` die feste Karte Broken Empire und prüft nach dem Laden weiterhin URL, Seed, Karte und Classic-Regelprofil. Alle drei Starttests bestanden in der gezielten Nachprüfung. Die 61 Karten- und Spielstandstests, Gebäude- und Animationsaudit, Standardbuild und Docker-Smoke-Test bestanden. HQ und Kaserne wurden bei der Standardkamera mit Zoom 0,59 im Spiel geprüft. [GitHub-Abnahme in PR #497](https://github.com/nfekete82/sandforge/pull/497).
