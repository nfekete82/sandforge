# Sandforge – neue PBR-Eroberungsbastion mit drehendem Radar

## Problem und Lösung

Das bisherige Bastion-Modell in GitHub war noch die alte, schwarze, mehrstöckige Variante mit **runder** Satellitenschüssel. PR #324 enthielt zunächst nur ein ZIP-Installationsskript; ein normales `git pull` und `npm run build` änderte den Inhalt der GLBs daher nicht.

**Korrigiert:** Der vollständige Generator `scripts/generate-bastion-radar.mjs` ist nun in Git enthalten und nutzt ausschließlich Node.js-Bordmittel. `npm run build` führt ihn automatisch **vor** dem Kopieren der Assets ins `dist/` aus. Dadurch werden alle drei alten Bastions-GLBs bei jedem Build durch die neue kompakte Version ersetzt. **Keine ZIP und kein Meshladen aus fremden Quellen nötig.**

## Design / technische Daten

- Kompakte, deutlich flachere achteckige Bastion mit sandfarbenem Sockel, grünen Wüstentarnflächen, Metallverstrebungen, Stern-Banner, kleinen Lüftungsgittern und Schutzelementen
- Eindeutig **rechteckiges** drehendes Radar statt der großen runden Schüssel
- Drei GLB-2.0-Dateien: `bastion--1.glb` (neutral), `bastion-0.glb` (blau), `bastion-1.glb` (rot)
- Jeweils **19 Material-Meshes, 14 eingebettete PNG-Albedo-PBR-Texturen und 2340 Dreiecke**, etwa **303 KB je Datei**
- `BastionRadarRotor` als eigenständiger glTF-Knoten mit `RadarSpin`-Animation (360° in 8 Sekunden). Im vorhandenen `webgl-battlefield.js` wird der Clip automatisch über `THREE.AnimationMixer` abgespielt.
- Originales Gameplay: Eroberung, Teamwechsel, Sektoreinkommen, KI, Fog of War und Capture-UI bleiben unverändert

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

`tests/webgl-bastion-pbr-radar.test.mjs` meldet jetzt einen Fehler, wenn noch die alte GLB im Worktree liegt. Der Test prüft zusätzlich den Generator-Marker `sandforge-bastion-radar-v2`, drei Fraktionsvarianten, die eigenen Radarrotoren und Animationskanäle. Der komplette Build erzeugt die drei benötigten GLBs deterministisch vor dem Test. Ohne erfolgreiche Node-Tests oder Sichtprüfung im Browser PR #324 noch nicht mergen.

Die generierten GLBs sind Arbeitskopie-Artefakte und noch nicht als Binärdateien committed; **der zur Erzeugung notwendige Sourcecode ist vollständig auf GitHub**.
