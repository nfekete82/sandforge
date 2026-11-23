# Flammenpanzer — in Sandforge integrierter WebGL-Panzer (23.11.2026)

Der Einheitentyp `flamer` kostet 500 Credits und wird in der Fahrzeugfabrik gebaut.
Seine Flamme reicht 245 M, trifft bei freier Sicht garantiert und verursacht hohen Infanterieschaden;
gegen Panzer, Mauern und Flugzeuge bleibt er schwach. Eine zweilagige WebGL-Flammenzunge
verläuft bis zum Ziel, ohne den vorherigen runden Lichtpunkt über dem Fahrzeug.

## 3D-Modell und Build

Die PBR-GLBs für beide Fraktionen werden jetzt automatisch und reproduzierbar aus
`scripts/generate-flame-tank-pbr.mjs` in den Build geschrieben:

- `dist/src/assets/reborn/animation/flamer-0.glb` — blau
- `dist/src/assets/reborn/animation/flamer-1.glb` — rot

Wenn hochwertige, bereits vorhandene GLBs unter `src/assets/reborn/animation` liegen,
behalten diese Vorrang. **Kein ZIP-Download nötig**. Der reguläre WebGL-Build und
die Produktionsauswahl funktionieren auch bei einem sauberen Checkout.

## Lokaler Test ohne Änderungen an main

```bash
cd ~/Projects/sandforge-bastion-wars
git fetch origin
git worktree add ../sandforge-flame-test origin/feat/flame-tank-playtest-20261123
cd ../sandforge-flame-test

npm ci
npm run build
node --test tests/sandforge-flame-tank-playtest.test.mjs
PORT=8158 npm run preview
```

Direkt ausprobieren:
`http://127.0.0.1:8158/webgl-preview.html?flameTest=1&seed=9999&play=1`

Das explizite lokale Query-Flag `flameTest=1` setzt einen blauen Flammenpanzer und
ein rotes schweres Infanterieziel in Flammenreichweite. Es wird **nicht** in normalen
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

Status: Vollständig im Git-Repository enthalten, einschließlich Generator und Tests.
Für den lokalen Grafiktest weiterhin `flameTest=1` nutzen; normale Partien schalten den
Panzer über die Fahrzeugfabrik frei.
