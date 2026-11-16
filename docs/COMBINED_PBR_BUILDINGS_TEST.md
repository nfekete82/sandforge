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