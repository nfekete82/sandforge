# Sandforge – Integrationsstand 17.11.2026

## Eingefrorener Spielstand

- Gemeinsame Ausgangsbasis: `develop` (844af93f9ac8e639b91e8939ca9ab39425e4cdb9)
- Aktuell sichtgeprüfter Bastion-/Gebäude-/Silo-Stand: `feat/bastion-pbr-radar-capture-20261116` @ `240d9749e189df4f10ac9534d42823e0c26a94ba`
- Snapshot-Branch: `integration/sandforge-current-20261117`
- Enthält die aufeinander aufbauenden Änderungen aus PR #321, #322, #323 und #324 sowie deren gemeinsamen Vorfahren.
- Raketensilo: vom Nutzer anhand des Screenshots am 17.11. ausdrücklich als endgültiger Look akzeptiert; die schmale schwarze Fuge bleibt.
- Andere offene experimentelle PRs gehören nicht automatisch in diesen Snapshot.

## Nachgewiesener Mac-Teststand (17.11.2026)

Vom Nutzer bereitgestelltes vollständiges Terminalprotokoll für den Snapshot `345fad175a2f9cc8dc0b464b0f5323d3cbe6307e`:

- `git fetch origin && git merge --ff-only origin/integration/sandforge-current-20261117`: erfolgreich, nur diese Statusdokumentation hinzugefügt.
- `bash scripts/install-bastion-pbr-test.sh`: Build erfolgreich (`tsc -p tsconfig.json && node scripts/build.mjs`).
- Die vier finalen PBR-GLBs für Kaserne/Kommandozentrale waren im vorhandenen Mac-Worktree bereits korrekt installiert.
- Der Build generierte je Fraktion die Bastion, Fabrik, Energiekern und das Flugfeld neu; finale PBR-Kaserne/HQ und Bastion gemeinsam in `dist/` bestätigt.
- **199 Tests ausgeführt, 199 bestanden, 0 fehlgeschlagen, 0 übersprungen**.
- Getestet wurden u. a. Raketen-Silo/Shader/HUD/Bauvorschau, PBR-Asset-Synchronisation, drehende Bastion, Fabrik-/Flugfeld-Rolltore und Startwege sowie KI-, Bau-, Navigations- und Forschungsregressionen.
- Die ältere Vorschau auf `http://127.0.0.1:8111` war zuvor gestartet und per Ctrl-C beendet worden; nach dem Snapshot-Build zeigt das Protokoll **keinen erneuten aktiven Previewserver oder neuen vollständigen Browser-Smoke-Test**.
- **Nur lokaler Mac-Nachweis, keine GitHub-Actions-CI-Freigabe und kein Fresh-Clone-Test.**

## Integrationssperren

1. Die vier finalen PBR-Binärmodelle `barracks-{0,1}.glb` und `headquarters-{0,1}.glb` sind **nicht vollständig aus Git reproduzierbar**. `scripts/ensure-final-pbr-buildings.mjs` benötigt bereits vorhandene Mac-Quellworktrees oder das validierte gemeinsame PBR-Arbeitsverzeichnis. Ein frischer Checkout kann deshalb den Build abbrechen.
2. Für den Snapshot sind keine erfolgreichen GitHub-Actions-CI-Runs zu den letzten Änderungen dokumentiert. Der lokale Mac-Gesamttest auf Snapshot `345fad17` ist mit 199/199 Tests bestanden; ein unabhängiger CI-/Fresh-Clone-Test ist weiterhin nicht nachgewiesen.
3. `main` und `develop` sind divergiert (Vergleich 17.11.: `develop` gegenüber `main` 2781 Commits voraus, 7 zurück). Deshalb kein Fast-Forward auf `main` und keine automatische Produktionsfreigabe.
4. Mehrere aufeinander aufbauende PRs sind noch als Draft markiert. Erst nach unabhängiger Build-/Browserprüfung konsolidiert nach `develop` übernehmen.

## Reproduzierbarer Test auf dem bisherigen Mac-Worktree

```bash
cd ~/Projects/sandforge-bastion-pbr-test
git fetch origin
git merge --ff-only origin/feat/bastion-pbr-radar-capture-20261116
bash scripts/install-bastion-pbr-test.sh
PORT=8111 npm run preview
```

Im Browser das Spiel auf Port 8111 prüfen: Silo, fertige HQ-/Kasernen-PBR-Assets, neue Bastion mit drehendem Radar, Flugfeld/Fabrik, HUD-Gebäudeicons, Ghost-Preview, Spielstart und Bau-/Produktionsabläufe.

## Promotion

- Testnachweise und finale Modell-Binärdateien oder einen in Git selbstständigen Generator sicherstellen.
- Integration-PR gegen `develop` reviewen und mergen.
- Danach `develop` ↔ `main` Konflikte bewusst auflösen, CI und Browser erneut ausführen, erst dann Release/Deployment.
