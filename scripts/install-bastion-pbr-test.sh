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
for owner in -1 0 1; do
 cp "$ASSETS/bastion-$owner.glb" "$BACKUP/bastion-$owner.glb"
done
rollback(){
 echo "Bastion-Build/Test fehlgeschlagen; alte GLBs werden zurückkopiert: $BACKUP" >&2
 for owner in -1 0 1; do
  cp "$BACKUP/bastion-$owner.glb" "$ASSETS/bastion-$owner.glb"
 done
}
trap rollback ERR
npm run build
node --test \
 tests/webgl-bastion-pbr-radar.test.mjs \
 tests/sandforge-bastion-navigation.test.mjs \
 tests/webgl-building-portrait-readability.test.mjs
trap - ERR
echo "Alle drei Bastionen aus Git-Code generiert, ohne ZIP. Backup: $BACKUP"
echo "Preview: PORT=8111 npm run preview"
echo "ACHTUNG: Port 8110 ist der alte Kaserne/HQ-Teststand."
