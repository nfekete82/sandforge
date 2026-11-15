# Keystone HQ – isolierter WebGL-Test

Das Modell **A_hq_KEYSTONE.glb** ist ein Drittanbieter-Asset und wird **nicht in das öffentliche GitHub-Repository** aufgenommen.

1. `A_hq_KEYSTONE.glb` nach `src/assets/reborn/local-keystone/A_hq_KEYSTONE.glb` kopieren.
2. `npm run dev` (der Build kopiert das lokale Asset automatisch nach `dist/`).
3. `http://localhost:8095/webgl-preview.html?keystone=1` (Port ggf. durch die vom lokalen Server ausgegebene Nummer ersetzen) öffnen.
4. Eine Kommandozentrale bauen. Alternativ vorhandenen Spielstand laden, der eine Kommandozentrale enthält.
5. Zum Vergleich `?keystone=1` entfernen: Das reguläre HQ bleibt vollständig unverändert.

Im Preview-Modus gelten dieselben Sandforge-Bau-, Spiel- und Kollisionsregeln. Nur das 3D-HQ wird lokal ersetzt, mit dem unveränderten PBR-Material, den eingebetteten Texturen, echten drei LODs, Schatten und dem `idle_spin`-Radarmixer. Es gibt **keine** neue Toranimation im Liefermodell. Die Karten-HUD-Vorschau zeigt das echte Keystone-LOD0.

Der Modus wird über eine URL-Abfrage aktiviert. Ohne die lokale GLB-Datei sollte man ihn nicht einschalten. Die Datei ist über `.gitignore` von Commits ausgeschlossen.
