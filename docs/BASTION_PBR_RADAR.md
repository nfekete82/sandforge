# Sandforge – neue PBR-Eroberungsbastion mit drehendem Radar

## Problem und Lösung

Das bisherige Bastion-Modell in GitHub war noch die alte, schwarze, mehrstöckige Variante mit **runder** Satellitenschüssel. PR #324 enthielt zunächst nur ein ZIP-Installationsskript; ein normales `git pull` und `npm run build` änderte den Inhalt der GLBs daher nicht.

**Korrigiert:** Der vollständige Generator `scripts/generate-bastion-radar.mjs` ist nun in Git enthalten und nutzt ausschließlich Node.js-Bordmittel. `npm run build` führt ihn automatisch **vor** dem Kopieren der Assets ins `dist/` aus. Dadurch werden alle drei alten Bastions-GLBs bei jedem Build durch die neue kompakte Version ersetzt. **Keine ZIP und kein Meshladen aus fremden Quellen nötig.**

## Design / technische Daten

- Deutlich **höhere, etwa 60 % gestreckte** achteckige Bastion mit sandfarbenem breiten Sockel, grünen Wüstentarnflächen, Metallverstrebungen, Stern-Banner, Lüftungsgittern und Schutzelementen; Grundfläche bleibt unverändert
- Eindeutig **rechteckiges** drehendes Radar statt der großen runden Schüssel
- Drei GLB-2.0-Dateien: `bastion--1.glb` (neutral), `bastion-0.glb` (blau), `bastion-1.glb` (rot)
- Jeweils **21 Material-Meshes und 16 eingebettete PNG-Albedo-PBR-Texturen**, rund **332 KiB je Datei**. Gegenüber der ersten Version nur zwei zusätzliche Material-Batches für Radarplattform und Warnleuchte
- `BastionRadarRotor` als eigenständiger glTF-Knoten mit `RadarSpin`-Animation (360° in 8 Sekunden). Im vorhandenen `webgl-battlefield.js` wird der Clip automatisch über `THREE.AnimationMixer` abgespielt.
- Originales Gameplay: Eroberung, Teamwechsel, Sektoreinkommen, KI, Fog of War und Capture-UI bleiben unverändert

## Update: höhere Bastion, echter Radarsockel, kollisionsfreies Warnlicht

- Der **Bastionskörper ist 60 % höher** als die vorherige PBR-Variante; der breit abgestützte Eroberungssockel bleibt gleich groß. Die Seitenstützen, Fenster und Sternflagge werden mit gestreckt. Nach der nichtuniformen Verlängerung werden die Normalen neu berechnet, damit das Wüstentarn-Material sauber ausgeleuchtet wird.
- Oben trägt eine **massive achteckige Stahl-/Bronzeplattform** mit Verstrebungen und zylindrischem Lager den Radarmotor. Die statische Plattform schneidet sich geringfügig mit dem unteren Teil des rotierenden Sockels; es gibt weder schwebenden Kopf noch Bodenlücke.
- Die blau/rot/neutral leuchtende **Warnleuchte besitzt ein eigenes Fundament und einen eigenen Haltemast** am äußeren Dachrand. Sie ist nicht Teil des rotierenden `BastionRadarRotor`, und ihr nächster Punkt liegt auch beim vollen 360°-Schwenk etwa **0,96 Modelleinhheiten** außerhalb des gesamten Radar-Schwenkkreises.
- Alle drei Fraktionsmodelle werden automatisch durch `npm run build` neu generiert. Der GLB-Marker lautet `sandforge-bastion-radar-v3-tall-platform`.
- Die GLB-Regressionsprüfung misst tatsächliche Grenzen von Turm, Plattform und Warnleuchte und verifiziert ihren Abstand zum vollen Radar-Drehkreis. Zusätzlich prüft sie die bereits vorhandene Eroberungs-/Teamwechsel-Logik. Spielsimulation, KI, Kollisionen, Gebietskontrolle und Fog of War bleiben unverändert.

## Auf dem Mac – ohne Download

```bash
cd ~/Projects/sandforge-bastion-wars
git fetch origin
git worktree add --detach ../sandforge-bastion-pbr-test origin/feat/bastion-pbr-radar-capture-20261116
cd ../sandforge-bastion-pbr-test
npm ci
npm run build
node --test tests/webgl-bastion-pbr-radar.test.mjs tests/sandforge-bastion-navigation.test.mjs
PORT=8111 npm run preview
```

**Achtung:** Falls der Test-Worktree schon besteht, nur `git fetch origin` und dort `git merge --ff-only origin/feat/bastion-pbr-radar-capture-20261116` ausführen. Den neuen Bastion-Test auf **Port 8111** öffnen, nicht die alte kombinierte Kaserne/HQ-Version auf Port 8110. Browser mit `Cmd+Shift+R` aktualisieren und eine neutrale Bastion auf der Karte betrachten.

## Tests / Freigabe

`tests/webgl-bastion-pbr-radar.test.mjs` meldet jetzt einen Fehler, wenn noch die alte GLB im Worktree liegt. Der Test prüft zusätzlich den Generator-Marker `sandforge-bastion-radar-v3-tall-platform`, drei Fraktionsvarianten, die eigenen Radarrotoren und Animationskanäle. Der komplette Build erzeugt die drei benötigten GLBs deterministisch vor dem Test. Ohne erfolgreiche Node-Tests oder Sichtprüfung im Browser PR #324 noch nicht mergen.

Die generierten GLBs sind Arbeitskopie-Artefakte und noch nicht als Binärdateien committed; **der zur Erzeugung notwendige Sourcecode ist vollständig auf GitHub**.


## HUD-Korrektur: Gebäudevorschauen bleiben auch gesperrt erkennbar

Die Kombination aus der kleineren, nicht-HDR-beleuchteten Offscreen-Kamera und mehrfachen CSS-Filtern verdunkelte einige Gebäudekacheln stark. Besonders die bereits gebaute und deshalb gesperrte Kommandozentrale erhielt gleichzeitig `opacity:.78` auf dem Container und `grayscale/blur/brightness(.70)/opacity(.77)` auf dem Bild.

- In `scripts/webgl-portraits.js` verwenden nun **alle** 3D-Gebäude- und Strategiebauwerk-Thumbnails eine eigene Studiobeleuchtung mit besserem hemisphärischem Fill und temporär maximal mindestens `1.28` Tone-Mapping-Exposure. Alle WebGL-Renderer-Einstellungen werden im `finally` zurückgesetzt; das eigentliche Sandforge-Spiel, Infanterie und Forschung bleiben unverändert.
- Die originale HQ-PBR-Spezialbehandlung bleibt aktiv; das Bild zeigt weiterhin die echten GLB-Albedo-/Normal-/Roughness-Texturen und nicht ein ausgedachtes aufgehelltes Material.
- In `src/reborn/webgl-classic-hud.css` werden gesperrte Gebäudekacheln über den gedämpften Hintergrund, Rahmen und den Preistext kenntlich gemacht, **nicht** mehr durch starke Graustufen, Unschärfe und mehrfache Opacity-Verringerung. Interaktionen für gesperrte Gebäude bleiben blockiert.
- `tests/webgl-building-portrait-readability.test.mjs` prüft, dass Beleuchtung und Belichtungsanpassung nur für Gebäude gelten, der Rendererzustand zurückgesetzt wird, die CSS-Regel die alte Verdunklung überschreibt und die Sperrlogik nicht verändert wurde.
- Die Icons werden bei Browser-Neustart neu generiert. Kein neues GLB, ZIP oder Asset erforderlich. Lokaler visueller Check der neuen HUD-Karten steht auf Port 8111 noch aus.
