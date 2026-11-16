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
