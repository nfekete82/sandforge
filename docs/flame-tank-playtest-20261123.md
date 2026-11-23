# Flammenpanzer — lokaler WebGL-Spieltest (23.11.2026)

Dieser Branch erweitert die Simulation um den Einheitentyp `flamer` (500 Credits, Fahrzeugfabrik).
Der Flammenpanzer kämpft auf kurze Distanz gegen Infanterie und Gebäude, ist gegen Panzer schwach
und kann keine Luftziele angreifen. Echte `flame`-Schüsse erzeugen gebündelte, begrenzte WebGL-Flammenpartikel.

## Modell-Dateien

Die **PBR-GLB-Dateien sind derzeit nicht im Git-Branch enthalten**. Das Testpaket aus dem
ChatGPT-Gespräch enthält folgende Dateien samt Generator:

- `src/assets/reborn/animation/flamer-0.glb` — blau
- `src/assets/reborn/animation/flamer-1.glb` — rot
- `scripts/generate-flame-tank-pbr.mjs` — reproduzierbare PBR-Asset-Erstellung

Das ZIP im Git-Worktree-Wurzelverzeichnis entpacken, bevor `npm run build` startet.
Fehlen die GLBs, erscheint im Spiel nur die vereinfachte Fahrzeug-Placeholder-Geometrie.

## Lokaler Test ohne Änderungen an main

```bash
cd ~/Projects/sandforge-bastion-wars
git fetch origin
git worktree add ../sandforge-flame-test origin/feat/flame-tank-playtest-20261123
cd ../sandforge-flame-test

# Das in ChatGPT bereitgestellte ZIP zuerst in ~/Downloads speichern.
unzip -o ~/Downloads/sandforge-flammenpanzer-playtest-assets.zip -d .

npm ci
npm run build
node --test tests/sandforge-flame-tank-playtest.test.mjs
PORT=8158 npm run preview
```

Direkt ausprobieren:
`http://127.0.0.1:8158/webgl-preview.html?flameTest=1&seed=9999&play=1`

Das explizite lokale Query-Flag `flameTest=1` setzt einen blauen Flammenpanzer und
ein rotes Infanterieziel nahe dem blauen Startsektor. Es wird **nicht** in normalen
Partien, geladenen Spielständen oder automatisierten KI-Simulationen verwendet.

Normaler Spielmodus: zuerst HQ und Fahrzeugfabrik errichten, anschließend im
Fahrzeugkatalog `Flammenpanzer` für 500 Credits produzieren.

## QA-Ziele

- Sichtbarer echter 3D-Panzer aus passender GLB-Datei (blau/rot), keine vier Räder oder Würfel
- Reichweite und Trefferverhalten des Flammenstroms
- HUD-Porträt stimmt mit Fahrzeugmodell überein
- Fahrt, Schatten, Teamfarbe, Fahrzeugspuren und Wrack
- Ausreichende FPS bei mehreren Flammenpanzern; dafür gepoolte Effekte nutzen
- Normaler Save/Load mit `kind: 'flamer'`
- Regressions-Build und neue Tests, bevor nach main gemergt wird

Status: **Testbranch**. Die Tests wurden aus ChatGPT heraus nicht auf deinem lokalen
Mac ausgeführt. Dieser Branch ist nicht automatisch produktiv bereit.
