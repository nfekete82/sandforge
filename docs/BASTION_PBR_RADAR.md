# Neue Eroberungsbastion – animiertes PBR-Radar im Sandforge-Stil

Die alte zylindrische, mehrstöckige Eroberungsbastion erhält einen kompakten, breiteren und niedrigeren **Wüstentarn-Turm mit achteckigem Sockel**. Dazu kommen dunkle Stahlverstrebungen, Lüftungsöffnungen, Sandsäcke, blaue/rote/neutralfarbene Capture-Lichter und ein blauer/roter/neutraler Stern-Banner.

Die Designreferenz ist das am 16. November 2026 gemeinsam entwickelte Bild eines flachen Wüstentarn-Eroberungsturms mit großem Radarpanel. Der erste Meshy-7.1-Bild-zu-3D-Render ist ein detailliertes Referenzmodell; die **separat erstellte, für Sandforge optimierte GLB** besitzt echte Teile und eine Animationsspur.

## Technische Daten der spieloptimierten GLB

- GLB 2.0, drei identische Geometrievarianten: `bastion--1.glb` (neutral), `bastion-0.glb` (Blau) und `bastion-1.glb` (Rot).
- 19 zusammengefasste Materialmeshes (etwa 3.788 Dreiecke); rund 1.2 MB pro GLB.
- 14 eingebettete PBR-Materialbilder, UVs, sandfarbene Betonstruktur und Camouflage.
- Eigenständiger GLB-Knoten `BastionRadarRotor`, getrennte Metall-Radar-Arrays und GLTF-Animationsclip `RadarSpin` mit linear interpolierter vollständiger Drehung.
- Namenspräfixe `BastionStatic_` und `BastionRadar_` für spätere Team-/Radar-Modifikationen.
- Bestehendes `scripts/webgl-battlefield.js` lädt schon die Bastion-GLB nach Eigentümer und erkennt `RadarSpin` automatisch. Keine zusätzlichen Fake-Radare nötig.
- Gameplay (Einflusskreis, Eroberungsdauer, Sektoreinkommen, Gebietspunkte, KI, Sicht/Fog) **unverändert**.

## Getrennter Mac-Spieltest

Lade `sandforge_bastion_radar_3teams.zip` herunter und speichere sie unter diesem Namen in Downloads.

```bash
cd ~/Projects/sandforge-bastion-wars
git fetch origin
git worktree add --detach ../sandforge-bastion-pbr-test origin/feat/bastion-pbr-radar-capture-20261116
cd ../sandforge-bastion-pbr-test
npm ci
bash scripts/install-bastion-pbr-test.sh
PORT=8111 npm run preview
```

Browser: http://localhost:8111/webgl-preview.html. Beim Spielen eine neutrale Bastion ansehen, erobern, auf Team-Rot-Wechsel prüfen und die gleichmäßige Drehung des Radars beobachten.

Der Installer prüft **alle drei** GLB-Dateien samt Radar-Animationsclip vor dem Austausch, sichert die bisherigen Originalmodelle und stellt sie bei Fehlern wieder her. Die bisherigen HQ/Kaserne-Versionen in anderen Worktrees bleiben unverändert.

## Git-Stand

Dieser Draft-PR enthält Installationsskript, Dokumentation und Regressionstests. Die drei kleinen **Binär-GLBs sind noch nicht in GitHub committet**: Für den lokalen Test werden sie aus der heruntergeladenen ZIP eingelesen. Nach erfolgreichem Browser-Test können die drei Dateien aus `src/assets/reborn/buildings-3d/` in den Branch eingecheckt und der PR gemergt werden. Der detaillierte Meshy-Render ist eine separate, höher aufgelöste Referenz und wird nicht als fertiger animierter Capture-Turm ausgegeben.
