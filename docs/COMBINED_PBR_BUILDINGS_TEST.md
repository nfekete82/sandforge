# Sandforge – gemeinsamer PBR-Test: Kaserne + Kommandozentrale

Dieser Teststand enthält **beide finalen PBR-Gebäude** in einem Sandforge-Spiel.

## Enthalten

- Kaserne: Wüstentarnung, PBR-Materialien, Doppeltor, Sandbags, Kisten, Stacheldrahtzaun, Kontakt-/Dachschatten.
- Kommandozentrale: gleiche Texturqualität, größere Form, mehrere getrennt animierte Radarsysteme, Doppeltor und denselben Stacheldrahtzaun.
- Getrennte funktionsfähige Produktionswege: Infanterie aus der Kaserne, Pioniere aus der Kommandozentrale.
- Gleichmäßigere, kürzere visuelle Anlaufphase aus beiden Gebäudetoren; Simulation bleibt unverändert.

## Auf deinem Mac

Die bestehenden Quell-Worktrees bleiben unangetastet: `~/Projects/sandforge-kaserne-prop-polish` und `~/Projects/sandforge-hq-pbr`.

```bash
cd ~/Projects/sandforge-bastion-wars
git fetch origin
git worktree add --detach ../sandforge-pbr-gesamt-test origin/feat/combined-barracks-hq-pbr-20261116
cd ../sandforge-pbr-gesamt-test
npm ci
bash scripts/install-combined-pbr-test.sh
PORT=8110 npm run preview
```

Browser: http://localhost:8110/webgl-preview.html

Für eine vorhandene Gesamt-Testkopie `git merge --ff-only origin/feat/combined-barracks-hq-pbr-20261116` nach `git fetch` ausführen.

## Sicherungen

Der Installer prüft **alle vier** GLBs (Blau/Rot für beide Gebäude) vor dem Kopieren. Bei einem Build- oder Testfehler werden die vier vorherigen Modelle automatisch aus einem Backup wiederhergestellt. Keine Downloads und keine Änderungen an den beiden Quell-Worktrees.

## Spieltest

1. Kommandozentrale bauen: Pionier produzieren und echte Tor-/Radar-Animation beobachten.
2. Kaserne bauen: Infanterie produzieren und den Einheitenausgang prüfen.
3. Beide parallel verwenden und auf freie Wege, Schattierung, Zaunkollisionen und FPS achten.

Die GLB-Binärdateien werden für den ersten Test **nur lokal in den neuen Worktree kopiert**, noch nicht auf GitHub committed. Den Branch erst nach dem Test zusammenführen.

## Kommandozentrale mit gepanzerter Dachkuppel

- Die Kommandozentrale bleibt gegenüber der Kaserne größer (ursprüngliche HQ-Konstruktion etwa 26 % breiter und 23 % tiefer); mit der zusätzlichen Dachkuppel wirkt auch der Gebäudekörper höher und deutlich massiver.
- Die runde Kommandokuppel besitzt echte 3D-Geometrie, beigefarbene Dach-/Wüstentarnung, eine betonierte Basis, ringsum schmale dunkle Aussichtsfenster und metallene Segmente.
- Die Kuppel belegt nur fünf zusätzliche Draw Calls und nutzt die **bereits eingebetteten** BaseColor-/Normal-/Roughness-Texturen des finalen HQ-Modells. Radarrotoren, Antennen, Doppeltor, Infanterieproduktion, Fundament und Kollision bleiben unverändert.
- `scripts/install-combined-pbr-test.sh` kopiert die beiden originalen HQ-GLBs aus dem vorhandenen lokalen Worktree und führt danach automatisch `node scripts/upgrade-hq-dome.mjs` für Blau und Rot aus. Kein neuer Download nötig.
- `tests/webgl-hq-dome.test.mjs` prüft beide Teammodelle, UV-/Normal-Daten, die vorhandenen PBR-Bildtexturen, freibleibende Radar- und Tür-Knoten sowie erneute idempotente Ausführung des Upgrade-Skripts.

## Stand 16.11.: HQ-Anordnung, Bastion-Freihaltung und direkter Sammelpunkt

- **HQ größer als die Kaserne:** die bestehende größere Kommandozentrale hat eine mittige PBR-Kuppel mit Radius `3.15` statt `1.92`, Oberkante `8.12` statt `6.63`, fünf zusätzliche texturierte Meshes. Der Gebäudefußabdruck und die Kollisionen bleiben unverändert.
- **Radar:** hoher Funkmast mit Signallampe rechts hinten am Dachrand, große Parabolschüssel links hinten, Phased-Array rechts und kleine drehende Schüssel rechts vorne. Alle drei originalen Rotorknoten drehen weiterhin separat.
- **Vordach:** echte Kasernen-PBR-Markise an der rechten Seitenwand, entlang der Fassade zentriert und 55 % breiter. Tragwerk, Füße und seitliche Kisten folgen dieser Position.
- **Bastionen:** moderne Kartengenerierung schließt authored Ruinen (inklusive Hindernisgeometrie) bis 1.150 Welt-Einheiten um alle Bastionen aus. Dekorative Dorfhäuser und deren Sandfahrspuren werden ebenfalls pro Haus und Dorfstraße mit 1.150 Einheiten Bastion-Abstand platziert. Andere Stellen der Karte dürfen weiterhin Ruinen haben.
- **Einheiten mit Sammelpunkt:** Infanterie aus der Kaserne und Pioniere aus der Kommandozentrale kommen vorne heraus, laufen ohne erzwungenen rechten Wartepunkt Richtung Sammelpunkt und werden nach der sichtbaren Torfreigabe schneller an die normale Bewegung übergeben. Ohne Sammelpunkt bleibt der Standard-Warteplatz rechts erhalten. Fabrik-/Fahrzeugtore bleiben unverändert.
- Der Installer `scripts/install-combined-pbr-test.sh` nimmt die unveränderten Team-GLBs aus den beiden älteren Test-Worktrees, führt `scripts/upgrade-hq-layout.mjs` und anschließend `scripts/upgrade-hq-dome.mjs` für Blau/Rot aus und prüft mit neuen Roof-/Bastion-/Rally-Regressionstests. Keine manuellen GLB-Downloads.
- Die Generatoren und Gameplay-Korrekturen sind vollständig auf GitHub. Die großen finalen GLB-Binärdateien werden beim Installieren **lokal generiert** und sind derzeit noch nicht in den Git-Branch gepusht.

### Erneut testen

```bash
cd ~/Projects/sandforge-pbr-gesamt-test
git fetch origin
git merge --ff-only origin/feat/combined-barracks-hq-pbr-20261116
bash scripts/install-combined-pbr-test.sh && PORT=8110 npm run preview
```

Browser: http://localhost:8110/webgl-preview.html (nach dem Beenden des alten Servers, danach Cmd+Shift+R). Den gesamten RTS-Test und Browser-Sichttest vor Merge nach `develop` abschließen.

## Korrektur: feste schwarze Lüftungsgitter statt überlagerter Klappen

- `scripts/upgrade-hq-vents.mjs` ersetzt das doppelte Seitenfenster-/Rahmen-Overlay der HQ-GLB: die vier überlagernden, weit herausragenden dunklen Platten werden hinter die Fassaden versenkt, während die sechs bereits eingebauten Kasernenstil-Lüftungsgitter der beiden Seitenwände bündig sichtbar bleiben.
- Zwei neue dunkle Lüftungseinheiten auf der HQ-Rückwand flankieren den bereits vorhandenen mittigen Lüftungsschacht. Sie bestehen aus realen 3D-PBR-Meshes für Einsätze, Lamellen und Rahmen, mit eingebetteten bestehenden Farb-, Normal- und Metall/Roughness-Maps.
- Drei zusätzliche GPU-Meshes für die gesamte Rückseite statt vieler einzelner Lüfter: `35+3+5=43` HQ-Meshes inklusive Dachkuppel; die Kaserne und die Eingangstor-/Pionierlogik sind unberührt.
- Der gemeinsame Installer nutzt beide Original-GLBs aus den Quell-Worktrees, führt `upgrade-hq-layout.mjs`, `upgrade-hq-vents.mjs` und `upgrade-hq-dome.mjs` nacheinander aus und prüft mit `tests/webgl-hq-vents.test.mjs` auch Blau und Rot. Kein erneuter Download erforderlich.
- Die umgebaute Kombinations-GLB wurde lokal für beide Fraktionen erzeugt und auf Mesh-Namen, Material-Maps, Binär-Header und Stückzahl geprüft. Der vollständige lokale Sandforge-Browserlauf erfolgt anschließend über `PORT=8110 npm run preview`.


## Feinschliff: Vordach ohne Schnittlinien, Radar etwas weiter rechts

- Im Modell `scripts/upgrade-hq-layout.mjs` werden die echten metallenen Vordachstreben dort, wo sie zuvor knapp durch die Stoffplane ragten, mindestens `0.17` Modell-Einheiten **unter** die bereits verbreiterte Plane gesetzt. Die diagonalen schwarzen Schnitt-/Z-Fighting-Linien sollen damit verschwinden. Tragfüße, Dach und Tore bleiben unverändert.
- Der rechteckige Radarspiegel `HQ_Radar_02_PhasedArray_Rotor` sitzt bei `x=5.87` statt `x=5.32` (+0.55 Modell-Einheiten nach rechts), mit intaktem Rotationspivot. Die kleine Schüssel vorn und der große Antennenmast bleiben an ihren Positionen.
- Die Layoutversion ist `centered-command-dome-roof-v4-canopy-20261116`. Der kombinierte Installer kopiert bei jedem Lauf wieder die originalen HQ-GLBs aus `sandforge-hq-pbr` und baut Layout, bündige Lüftung und Kuppel neu auf; die Kaserne bleibt unverändert.
- In `tests/webgl-hq-roof-layout.test.mjs` wird jetzt die reale Lage der Stahlpunkte **unter** der Plane und die neue Radarposition für beide Fraktionen geprüft. Die komplette GLB-Kette Layout→Lüftungen→Kuppel wurde für Blau und Rot erzeugt und erneut geöffnet: je 43 Meshes, 47/50 PBR-Bilder, 0.17 minimale Materialfreiheit, Radar `x=5.87`.
- Vollständigen lokalen Build, Node-Tests und optischen Browser-Test nach `git fetch` und `git merge --ff-only origin/feat/combined-barracks-hq-pbr-20261116` ausführen.


## HUD: Kommandozentrale in heller PBR-Studiobeleuchtung

Die HQ-GLB selbst hat auf Wand, Dach, Betonsockel und Stoff trotz eingebetteter Albedo-Texturen den metallischen Exportfaktor `1.0`. Im eigenständigen transparenten HUD-Render ohne HDR-Umgebungsreflexion erscheinen diese Flächen dadurch dunkel bis schwarz. Die bisherige Vorschau übermalte die ursprüngliche Wüstentarnung zusätzlich mit dem alten generischen Wüsten-Finish, während das 3D-Spiel die originalen HQ-PBR-Materialien unverändert nutzt.

- `scripts/webgl-hq-portrait.js` erkennt das echte HQ an seinen GLB-Meshes. Ausschließlich bei der **separaten HUD-Miniatur** werden die metallischen Exportwerte von Wand/Dach/Beton/Stoff auf maximal `0.13` begrenzt; Bodenplatten und Türen behalten ihre dunklen Farben. Die eingebetteten `map`, `normalMap` und `roughnessMap` bleiben erhalten. Ein dezentes albedo-basiertes Bounce-Light macht auch die Schattenseiten lesbar.
- `scripts/webgl-portraits.js` überspringt nur beim finalen authored HQ die generischen Fraktionsfarb-/Wüsten-Repaint-Shader und verwendet etwas stärkere, weiche Hemisphere-/Directional-/Ambient-Lichter in der **isolierten Portrait-Scene**. Die echte Battlefield-Scene und ihr Tonemapping werden nicht verändert.
- `scripts/build.mjs` kopiert das neue Modul nach `dist`, sodass die Standard-HUD-Icon-Pipeline es laden kann.
- `tests/webgl-hq-portrait-lighting.test.mjs` prüft die materialbezogene Aufhellung, die originalen Farb-, Normal- und Roughness-Maps, unveränderte dunkle Tore, Kaserne/Legacy-HQ sowie den Build-Importpfad.
- Die Portraits werden beim Neuladen des Spiels aus dem bereits im gemeinsamen Test-Worktree installierten HQ-GLB neu gerendert; keine neuen GLB-Dateien oder HUD-PNGs nötig.


## Ruhiger Einheiten-Ausgang ohne Geschwindigkeitsruck

- Pioniere aus dem PBR-HQ und Fußsoldaten aus der PBR-Kaserne erscheinen mit oder ohne Sammelpunkt auf demselben, kollisionsgeprüften **vorderen** Weg statt zunächst rechts um das Gebäude zu laufen. Ohne Sammelpunkt bleiben sie ca. fünf Meter außerhalb des Tores stehen; wenn der Weg blockiert ist, bleibt der bisherige sichere Seiten-Spawn als Fallback erhalten.
- `src/reborn/production-exit.ts`: erster Fuß-Spawn bei `base.radius+75`; weitere freie Ausweichpunkte `+100/+130`, seitlich `0/±22/±45` je nach Gebäudedrehung. Die normale klassische Simulation ohne WebGL-Staging bleibt unverändert.
- `scripts/webgl-production-gates.js`: bei echten Front-Spawns durchgehend linearer Weg Innenraum → Tor → **exakte autoritative Position**, nach realer Gesamtstrecke mit der regulären Rollengeschwindigkeit (105/92/78), statt einer 0.5-Sekunden-Beschleunigungsphase mit separatem Smoothstep-Bogen. Das zuständige Gameplay-Hold endet beim Eintreffen am realen Spawn, nicht erst nach dem Türschließen. Ein bereits eingestellter Rally bleibt während des Ausstiegs fest zugeordnet, auch wenn später der Gebäudesammelpunkt verschoben wird.
- `scripts/webgl-actor-presentation.js`: die GLB-Laufanimation der Infanterie spielt auch während des Tor-Ausgangs mit normaler Rate `1` statt `driveSpeed/80`; daher kein kurzer Sprint mit nachfolgendem Standbild. Bei Sammelpunkt wird die Laufen-Animation für höchstens zwei Simulationsticks beim Übergang erhalten; Figur dreht sich zuletzt allmählich in die Richtung ihres tatsächlichen Rally-Auftrags.
- Simulations-Aufträge, Einheitenslots, Kosten, KI, Spielkollisionen, Fabrik-/Fahrzeugausgänge und gespeicherte Spielstände bleiben unverändert. Die Konstruktion der Tore und PBR-GLBs wird nicht verändert.
- Tests `tests/webgl-infantry-rally-direct.test.mjs` (alle vier Drehungen, mit/ohne Rally) und `tests/webgl-infantry-gate-continuity.test.mjs` (Kaserne/HQ, gleitender 105-Einheiten/s-Weg, keine Pause bei Übergabe) laufen automatisch im Installer.

Zur Aktualisierung:

```bash
cd ~/Projects/sandforge-pbr-gesamt-test
git fetch origin
git merge --ff-only origin/feat/combined-barracks-hq-pbr-20261116
npm run build
node --test tests/webgl-infantry-gate-continuity.test.mjs tests/webgl-infantry-rally-direct.test.mjs tests/webgl-production-gates.test.mjs tests/webgl-production-rally.test.mjs
PORT=8110 npm run preview
```
