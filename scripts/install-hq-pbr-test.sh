#!/usr/bin/env bash
# Installs the two validated HQ PBR models from Downloads in a separate worktree.
# This does not alter the main working copy; Git tracks both modified GLBs.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
ASSETS="src/assets/reborn/buildings-3d"
DOWNLOADS="${SANDFORGE_HQ_DOWNLOADS:-$HOME/Downloads}"
BLUE="$DOWNLOADS/sandforge_kommandozentrale_pbr.glb"
RED="$DOWNLOADS/sandforge_kommandozentrale_rot_pbr.glb"

for item in "$BLUE" "$RED"; do
 if [[ ! -s "$item" ]] || [[ "$(head -c 4 "$item")" != "glTF" ]]; then
  printf 'Fehlt oder ist kein GLB: %s\n' "$item" >&2
  exit 1
 fi
done
if ! grep -q 'HQ_Radar_01_LargeDish_Rotor' scripts/webgl-battlefield.js; then
 echo "Falscher Git-Stand: bitte zuerst origin/feat/hq-pbr-from-barracks-20261116 aktualisieren." >&2
 exit 1
fi
BACKUP="$(mktemp -d "${TMPDIR:-/tmp}/sandforge-hq-pbr.XXXXXX")"
cp "$ASSETS/headquarters-0.glb" "$BACKUP/headquarters-0.glb"
cp "$ASSETS/headquarters-1.glb" "$BACKUP/headquarters-1.glb"
rollback() {
 echo "Build/Test fehlgeschlagen; alte HQ-GLBs aus $BACKUP wiederhergestellt" >&2
 cp "$BACKUP/headquarters-0.glb" "$ASSETS/headquarters-0.glb"
 cp "$BACKUP/headquarters-1.glb" "$ASSETS/headquarters-1.glb"
}
trap rollback ERR
cp "$BLUE" "$ASSETS/headquarters-0.glb"
cp "$RED" "$ASSETS/headquarters-1.glb"
npm run build
node --test tests/webgl-hq-pbr-from-barracks.test.mjs \
 tests/webgl-barracks-pbr-production.test.mjs
trap - ERR
printf '\nHQ PBR in diesem Worktree installiert. Backup: %s\n' "$BACKUP"
printf 'Start: PORT=8109 npm run preview\n'
printf 'Die GLB-Änderungen sind zunächst NUR LOKAL, nicht auf GitHub.\n'
