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
- Classic aus dem vorgesehenen Testverzeichnis: 116 von 125 bestanden. Der erweiterte WebGL-Sammellauf bestand 162 von 231 Tests. Getrennte Profile bestanden sieben Classic-Titeltests und sämtliche 61 prozeduralen WebGL-Kartentests. Der WebGL-Sammellauf umfasst historische Meshy-Vorschauen, deren separater Build die nicht mitgelieferte optimierte Factory-GLB voraussetzt.
- Standardbuild, Docker-Build und HTTP-Smoke für WebGL, Classic, Atlas und HQ-Asset sowie Gebäude- und Animationsaudit sind erfolgreich. Die Auditberichte prüfen 15 Gebäude-GLBs, 109 PNGs, acht lizenzierte Originalmodelle und 18 aktive Animationsatlanten.
- GitHub meldet für `40375420` 21 von 23 erfolgreichen Workflows. `Build and simulation tests` und `Sandforge Tactical AI 3.0 - learning and overrun` bleiben rot.
- Das Dateischutzmuster für GLB, GLTF und verworfene Klippenshader ist aktiv. Die 13 lokalen GLB-Änderungen im ursprünglichen Checkout bleiben erhalten. Release-Tag und Verifikation des gemergten `main` stehen weiter aus.
