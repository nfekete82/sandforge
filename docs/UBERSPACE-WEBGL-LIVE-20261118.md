# WebGL 3D live auf Uberspace – private Alpha (18.11.2026)

Die 3D-WebGL-Version lässt sich mit dem bestehenden geschützten
Release-System auf `nf.uber.space` veröffentlichen. Die ältere Canvas-Version
bleibt in jedem Release unter einer *versionierten*, passwortgeschützten URL
erreichbar. Der Apache-Guard und das persönliche Passwort bleiben unverändert.

**Wichtig:** Die finalen PBR-HQ-/Kasernenmodelle liegen aktuell nur lokal
auf dem Mac, nicht als vollständige GitHub-Dateien. Daher muss die reale
Veröffentlichung vom Mac aus dem gebauten Worktree erfolgen. GitHub CI
prüft mit einem Modul-Audit; es veröffentlicht **nichts** automatisch.

## Freigabe und Upload aus dem bestehenden Worktree

```bash
cd ~/Projects/sandforge-r01-test
git fetch origin
git merge --ff-only origin/integration/sandforge-current-20261117
export SANDFORGE_COMBINED_PBR_SOURCE="$HOME/Projects/sandforge-pbr-gesamt-test"

npm ci
npm --prefix tests/browser ci
npm run build

node --test \
  tests/sandforge-recon-drone.test.mjs \
  tests/reborn-ai-ignore-drone-20261118.test.mjs \
  tests/sandforge-bastion-economy-rollback-20261117.test.mjs

# Prüft das private Uberspace-Ziel, verifizierte PBR-Dateien und WebGL
# inklusive Chrome-Browser. Kein Umschalten des Live-Releases.
npm run deploy:uberspace:dry-run

# Nur nach bestandenem Dry-Run. Atomare Aktivierung erst nach
# vollständiger Hash-, Browser- und HTTPS-Authentifizierungskontrolle.
npm run deploy:uberspace

# Live prüfen
npm run deploy:uberspace:check
```

Der Deploy toleriert nur die lokal *modifizierten PBR-GLB-Modelle* im
Pfad `src/assets/reborn/buildings-3d/` und den übrig gebliebenen
ungetrackten Altordner `src/assets/reborn/supply-pbr/`. **Sonstige
unkommittierte Quelländerungen blockieren den Upload.** Weder
`git reset --hard` noch `git clean -fd` verwenden.

## Schutz, Wartung, Rollback

- HTTPS und Basic Auth bleiben aktiv. Private Alpha für bekannte Nutzer;
  keine öffentlichen Links oder offen zugängliche Gameplay-Dateien.
- Kein Upload von Source-Maps, TypeScript, Debug-HTML, Secrets oder
  dem stillgelegten Nachschubsystem.
- HTTP-Root bleibt `/`, 3D-Modulimporte werden auf
  `/releases/<release-id>/...` fixiert; selbst ein bereits laufendes
  Match lädt dadurch nur seine eigene Release-Version.
- Neue Artefakte werden unter `/var/www/virtual/nf/.sandforge/releases`
  erstellt und vor dem Umschalten validiert.
- Die aktive `.current`-Symlink-Version wechselt erst nach bestandener
  Staging-Prüfung. Bei einem Fehler wird die alte Version wieder aktiviert.
- Zurück zum vorherigen Live-Stand:
  `npm run deploy:uberspace:rollback`.
- SSH verwendet den vorhandenen Mac-Schlüssel
  `~/.ssh/id_ed25519`, ohne ihn zu kopieren. Keine Passwörter im Git.
- Browserchecks benötigen lokal Chrome oder via `ATLAS_BROWSER_CHANNEL=chromium`
  das installierte Playwright-Chromium.

**Status:** GitHub-Merge ist nicht gleich Live-Deployment; nur der von
`npm run deploy:uberspace:check` bestätigte Release gilt als live.
