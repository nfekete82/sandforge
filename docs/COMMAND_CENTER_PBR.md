# Sandforge HQ — PBR-Kommandozentrale im Kasernenstil

Die **GLB-Datei** wird aus dem bewährten originalen 11-MB-Kasernenmodell gebaut, das für den lokalen Test bereitgestellt wurde. Es handelt sich nicht um ein statisches Bild: Wände, Dach, Fenster, Radar und Türflügel besitzen echte 3D-Geometrie.

## Design

- ca. 26 % breiter, 23 % tiefer, 14 % höher als die ursprüngliche Kaserne
- originale Wüstentarnung, Sandbeton, Stahl, Sandbags, Kisten, Dach, Rahmen, UVs und BaseColor/Normal/Metallic-Roughness-Texturen
- breitere dunkle Lüftungs-/Fensterflächen vorne und an den Seiten
- großes Original-Doppeltor; Bau-/Pionierlogik bleibt unverändert
- drei getrennt drehbare Dachbaugruppen: große Parabolschüssel, rechte Phased-Array-Installation, kleine Parabolschüssel
- weiterer Funkmast, Antennen, Versorgungseinheiten, Leitungsführungen, warme Sicherheitsleuchten

## Technische Details

- GLB 2.0, alle PBR-Bilder intern eingebettet, keine externen URL-Abhängigkeiten
- 35 kombinierte Material-Meshes (vor Batching 457; ca. 10.038 Dreiecke)
- Radar-Gruppenknoten `HQ_Radar_01_LargeDish_Rotor`, `HQ_Radar_02_PhasedArray_Rotor`, `HQ_Radar_03_MiniDish_Rotor`
- animierbare Türflügel `HQ_door_leaf_L`, `HQ_door_leaf_R`
- teambezogene kleine Statuslampen, keine großflächige Nachfärbung der eingebetteten Texturen
- die anderen Gebäudetypen einschließlich Kaserne bleiben unangetastet

## Mac / getrennter Test

Die generierten GLBs `sandforge_kommandozentrale_pbr.glb` (Team Blau) und `sandforge_kommandozentrale_rot_pbr.glb` (Team Rot) in `~/Downloads` speichern, dann:

```bash
cd ~/Projects/sandforge-kaserne-prop-polish
git fetch origin
git worktree add -b test/hq-pbr-20261116 ../sandforge-hq-pbr origin/feat/hq-pbr-from-barracks-20261116
cd ../sandforge-hq-pbr
npm ci
bash scripts/install-hq-pbr-test.sh
PORT=8109 npm run preview
```

Browser: http://localhost:8109/webgl-preview.html

Die GLBs sind **noch nicht im Git-PR**; das Skript kopiert sie in den Test-Worktree. Erst nach Sicht- und Produktionstest `git add src/assets/reborn/buildings-3d/headquarters-{0,1}.glb` und commit/push ausführen. Keine direkte Änderungen am Haupt-Worktree.
