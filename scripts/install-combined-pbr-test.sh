#!/usr/bin/env bash
# Unified final PBR test: copy validated assets from existing local worktrees.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
ASSET_DIR="src/assets/reborn/buildings-3d"
BARRACKS_SOURCE="${SANDFORGE_BARRACKS_SOURCE:-$HOME/Projects/sandforge-kaserne-prop-polish}"
HQ_SOURCE="${SANDFORGE_HQ_SOURCE:-$HOME/Projects/sandforge-hq-pbr}"
if [[ "$BARRACKS_SOURCE" == "$ROOT" || "$HQ_SOURCE" == "$ROOT" ]]; then
 echo "Quelle und Ziel müssen unterschiedliche Worktrees sein." >&2
 exit 1
fi
for source in "$BARRACKS_SOURCE" "$HQ_SOURCE"; do
 if [[ ! -d "$source/$ASSET_DIR" ]]; then
  printf 'Fehlender Test-Worktree: %s\n' "$source" >&2
  exit 1
 fi
done
if ! grep -q 'HQ_Radar_01_LargeDish_Rotor' scripts/webgl-battlefield.js ||
   ! grep -q 'polishBarracksProps' scripts/webgl-battlefield.js; then
 echo "Falscher Git-Stand: erst den gemeinsamen PBR-Branch aktualisieren." >&2
 exit 1
fi
validate_glb(){
 node --input-type=commonjs - "$1" "$2" <<'NODE'
const fs=require('fs');
const [file,kind]=process.argv.slice(2);
const b=fs.readFileSync(file);
if(b.length<28||b.toString('ascii',0,4)!=='glTF'||
   b.readUInt32LE(4)!==2||b.readUInt32LE(8)!==b.length)
 throw Error('Ungültige GLB 2.0: '+file);
const n=b.readUInt32LE(12);
if(b.toString('ascii',16,20)!=='JSON')throw Error('GLB ohne JSON: '+file);
const doc=JSON.parse(b.toString('utf8',20,20+n));
const names=new Set((doc.nodes||[]).map(x=>x.name));
const keys=kind==='barracks'
 ?['door_leaf_L','door_leaf_R','door_recess_back']
 :['HQ_door_leaf_L','HQ_door_leaf_R','HQ_Radar_01_LargeDish_Rotor','HQ_Radar_02_PhasedArray_Rotor'];
for(const name of keys)if(!names.has(name))
 throw Error('Falsches '+kind+'-Modell (Mesh fehlt: '+name+'): '+file);
if(!(doc.images?.length>0))throw Error('GLB enthält keine PBR-Bildtexturen: '+file);
console.log('OK '+kind+': '+file+' ('+(b.length/1048576).toFixed(1)+' MiB)');
NODE
}
for owner in 0 1; do
 validate_glb "$BARRACKS_SOURCE/$ASSET_DIR/barracks-$owner.glb" barracks
 validate_glb "$HQ_SOURCE/$ASSET_DIR/headquarters-$owner.glb" headquarters
done
BACKUP="$(mktemp -d "${TMPDIR:-/tmp}/sandforge-combined-pbr.XXXXXX")"
for file in barracks-0.glb barracks-1.glb headquarters-0.glb headquarters-1.glb; do
 cp "$ASSET_DIR/$file" "$BACKUP/$file"
done
rollback(){
 printf 'Fehler: GLBs aus Backup %s wiederherstellen.\n' "$BACKUP" >&2
 for file in barracks-0.glb barracks-1.glb headquarters-0.glb headquarters-1.glb; do
  cp "$BACKUP/$file" "$ASSET_DIR/$file"
 done
}
trap rollback ERR
for owner in 0 1; do
 cp "$BARRACKS_SOURCE/$ASSET_DIR/barracks-$owner.glb" "$ASSET_DIR/barracks-$owner.glb"
 cp "$HQ_SOURCE/$ASSET_DIR/headquarters-$owner.glb" "$ASSET_DIR/headquarters-$owner.glb"
done
# Adjust all three real radar pivots, move the original mast to the
# far-right roof edge and recenter/widen the authored awning BEFORE the dome.
node scripts/upgrade-hq-layout.mjs \
 "$ASSET_DIR/headquarters-0.glb" \
 "$ASSET_DIR/headquarters-1.glb"
# Replace double-layer side windows with flush original louvers, and add
# matching rear ventilation from the already embedded PBR materials.
node scripts/upgrade-hq-vents.mjs \
 "$ASSET_DIR/headquarters-0.glb" \
 "$ASSET_DIR/headquarters-1.glb"
# Build the much larger centered dome from the original embedded PBR maps.
node scripts/upgrade-hq-dome.mjs \
 "$ASSET_DIR/headquarters-0.glb" \
 "$ASSET_DIR/headquarters-1.glb"
npm run build
node --test \
 tests/webgl-unified-pbr-buildings.test.mjs \
 tests/webgl-hq-dome.test.mjs \
 tests/webgl-hq-roof-layout.test.mjs \
 tests/webgl-hq-portrait-lighting.test.mjs \
 tests/webgl-hq-vents.test.mjs \
 tests/webgl-bastion-clearance.test.mjs \
 tests/webgl-infantry-rally-direct.test.mjs \
 tests/webgl-infantry-gate-continuity.test.mjs \
 tests/webgl-barracks-props.test.mjs \
 tests/webgl-barracks-yard-textures.test.mjs \
 tests/webgl-barracks-pbr-production.test.mjs \
 tests/webgl-barracks-infantry-clearance.test.mjs \
 tests/webgl-headquarters-pbr-production.test.mjs \
 tests/webgl-hq-pbr-from-barracks.test.mjs \
 tests/webgl-production-gates.test.mjs \
 tests/webgl-production-rally.test.mjs \
 tests/reborn-production.test.mjs
trap - ERR
printf '\nBeide finalen PBR-Gebäude in einem Test-Worktree installiert.\n'
printf 'GLB-Backup: %s\n' "$BACKUP"
printf 'Starten: PORT=8110 npm run preview\n'
printf 'Spiel: http://localhost:8110/webgl-preview.html\n'
printf 'GLB-Modelle sind bisher lokal, nicht auf GitHub committed.\n'
