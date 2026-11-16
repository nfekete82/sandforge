#!/usr/bin/env bash
# One-shot isolated visual test for the three new Bastion radar GLBs.
# Installs only in this worktree; restores old models on failures.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
SRC="${SANDFORGE_BASTION_ZIP:-$HOME/Downloads/sandforge_bastion_radar_3teams.zip}"
ASSETS="src/assets/reborn/buildings-3d"
if [[ ! -f "$SRC" ]]; then
 echo "Bastion-ZIP nicht gefunden: $SRC" >&2
 exit 1
fi
TEMP="$(mktemp -d "${TMPDIR:-/tmp}/sandforge-bastion-stage.XXXXXX")"
BACKUP="$(mktemp -d "${TMPDIR:-/tmp}/sandforge-bastion-backup.XXXXXX")"
cleanup(){ rm -rf "$TEMP"; }
trap cleanup EXIT
unzip -q "$SRC" -d "$TEMP"
# Validate all three models before altering the checked-out assets.
node --input-type=commonjs - "$TEMP" <<'NODE'
const fs=require('node:fs'),path=require('node:path');
for(const owner of [-1,0,1]){
 const filename='bastion-'+owner+'.glb',file=path.join(process.argv[2],filename);
 if(!fs.existsSync(file))throw Error('missing '+file);
 const b=fs.readFileSync(file);
 if(b.length<100||b.toString('ascii',0,4)!=='glTF'||
   b.readUInt32LE(4)!==2||b.readUInt32LE(8)!==b.length)
  throw Error('invalid GLB '+filename);
 const jsonLen=b.readUInt32LE(12);
 const data=JSON.parse(b.toString('utf8',20,20+jsonLen));
 const pivot=data.nodes.findIndex(n=>n.name==='BastionRadarRotor');
 const spin=data.animations?.find(a=>a.name==='RadarSpin');
 if(pivot<0||!spin||spin.channels?.some(ch=>ch.target?.node!==pivot))
  throw Error('independent rotating radar or RadarSpin clip missing '+filename);
 if(data.meshes?.length>24||data.images?.length<10)
  throw Error('incorrect PBR game asset, 24 meshes and embedded maps expected: '+filename);
 console.log('OK '+filename+': '+(b.length/1048576).toFixed(2)+' MiB, '+data.meshes.length+' meshes, '+data.images.length+' images');
}
NODE
for owner in -1 0 1; do
 cp "$ASSETS/bastion-$owner.glb" "$BACKUP/bastion-$owner.glb"
done
rollback(){
 echo "Bastion-Update fehlgeschlagen; bisherige drei GLBs werden wiederhergestellt." >&2
 for owner in -1 0 1; do
  cp "$BACKUP/bastion-$owner.glb" "$ASSETS/bastion-$owner.glb"
 done
}
trap rollback ERR
for owner in -1 0 1; do
 cp "$TEMP/bastion-$owner.glb" "$ASSETS/bastion-$owner.glb"
done
npm run build
node --test tests/webgl-bastion-pbr-radar.test.mjs
trap - ERR
echo "Fertig: Bastionen -1/0/1 ersetzt. Backup: $BACKUP"
echo "Preview: PORT=8111 npm run preview"
