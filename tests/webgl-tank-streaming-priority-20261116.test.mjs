import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const battlefield=readFileSync('scripts/webgl-battlefield.js','utf8');
const build=readFileSync('scripts/build.mjs','utf8');

test('real authored combat tank model ships for blue/red factions',()=>{
 for(const owner of [0,1]){
  const file=readFileSync('src/assets/reborn/animation/tank-'+owner+'.glb');
  assert.equal(file.toString('ascii',0,4),'glTF');
  assert.equal(file.readUInt32LE(4),2);
  assert.equal(file.readUInt32LE(8),file.length);
  assert.ok(file.length>1_000_000,'tank is the real detailed GLB, not a tiny primitive');
  const size=file.readUInt32LE(12);
  const gltf=JSON.parse(file.toString('utf8',20,20+size));
  const names=new Set(gltf.nodes.map(n=>n.name));
  assert.ok(names.has('Tank_Turret'),'real tank needs a rotating turret');
  assert.ok(names.has('Tank_Gun'),'real tank needs an independent cannon rig');
 }
 assert.match(build,/cpSync\('src\/assets', 'dist\/src\/assets', \{recursive:true\}\)/);
 assert.match(battlefield,/\['rover','tank','flamer','artillery','scout','bomber'\]\.includes\(kind\)\?'animation\/'/);
});

test('tank model streams in lite mode with high priority and a bounded error retry',()=>{
 assert.match(battlefield,/const priorityTank=type==='unit'&&\['tank','flamer'\]\.includes\(entity\.kind\)/);
 assert.match(battlefield,/\['medic','rocket','tank','flamer'\]\.includes\(entity\.kind\)/);
 assert.match(battlefield,/!priorityTank&&this\.loadingCount\+this\.modelQueue\.length>=this\.maxModels/);
 assert.match(battlefield,/\['tank','flamer','medic'\]\.includes\(entity\.kind\)/);
 assert.match(battlefield,/entry\.modelLoadError=null;entry\.modelLoadRetries=0/);
 assert.match(battlefield,/entry\.modelLoadRetries=\(entry\.modelLoadRetries\?\?0\)\+1/);
 assert.match(battlefield,/entry\.requested=false/);
 assert.match(battlefield,/this\.installTankRig\(entry,model\)/);
 assert.match(battlefield,/entry\.node\.remove\(entry\.placeholder\)/);
});

test('a transient tank placeholder has genuine desert-armoured tracked silhouette',()=>{
 assert.match(battlefield,/Tank_HullArmour/);
 assert.match(battlefield,/Tank_TrackBelt_/);
 assert.match(battlefield,/Tank_RoadWheel_/);
 assert.match(battlefield,/Tank_TurretArmour/);
 assert.match(battlefield,/Tank_MainCannon/);
 assert.match(battlefield,/Tank_MuzzleBrake/);
 assert.match(battlefield,/color:'#9b9176'/);
 assert.match(battlefield,/if\(!\['tank','flamer'\]\.includes\(kind\)\)for\(const x of \[-22,22\]\)/);
});
