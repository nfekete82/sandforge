#!/usr/bin/env bash
# No ZIP download: GLBs are generated from the Git-committed Node script
# on every npm run build.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
ASSETS="src/assets/reborn/buildings-3d"
if [[ ! -f scripts/generate-bastion-radar.mjs ]]; then
 echo "Alten Branch geladen: erst Git aktualisieren." >&2
 exit 1
fi
BACKUP="$(mktemp -d /tmp/sandforge-bastion-backup.XXXXXX)"
# Back up all seven assets, not just the Bastion: this combined preview
# replaces four older building GLBs as well.
for file in bastion--1.glb bastion-0.glb bastion-1.glb \
            barracks-0.glb barracks-1.glb \
            headquarters-0.glb headquarters-1.glb; do
 cp "$ASSETS/$file" "$BACKUP/$file"
done
rollback(){
 echo "Bastion-Build/Test fehlgeschlagen; alte GLBs werden zurückkopiert: $BACKUP" >&2
 for file in bastion--1.glb bastion-0.glb bastion-1.glb \
             barracks-0.glb barracks-1.glb \
             headquarters-0.glb headquarters-1.glb; do
  cp "$BACKUP/$file" "$ASSETS/$file"
 done
}
trap rollback ERR
npm run build
node --test \
 tests/webgl-bastion-pbr-radar.test.mjs \
 tests/sandforge-bastion-navigation.test.mjs \
 tests/webgl-building-portrait-readability.test.mjs \
 tests/webgl-authored-barracks-portrait.test.mjs \
 tests/webgl-final-pbr-asset-sync.test.mjs \
 tests/webgl-unified-pbr-buildings.test.mjs \
 tests/webgl-hq-dome.test.mjs \
 tests/webgl-hq-portrait-lighting.test.mjs \
 tests/webgl-roof-stripes-and-wall-placement.test.mjs \
 tests/webgl-entrance-banners-and-hud-compact.test.mjs \
 tests/webgl-factory-pbr-and-faction-palette.test.mjs \
 tests/webgl-pause-resume-consistency.test.mjs
trap - ERR
echo "Bastion + finale PBR-Kaserne + PBR-Kommandozentrale geladen. Backup: $BACKUP"
echo "Preview: PORT=8111 npm run preview"
echo "Port 8111 zeigt jetzt alle drei FINALEN Gebäude gemeinsam."
