import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {factionRgb8} from '../scripts/sandforge-faction-palette.js';

const root='src/assets/reborn/buildings-3d/';
const src=name=>readFileSync('scripts/'+name,'utf8');
function glb(team){
 const file=readFileSync(root+'airfield-'+team+'.glb');
 assert.equal(file.toString('ascii',0,4),'glTF');
 assert.equal(file.readUInt32LE(4),2);
 assert.equal(file.readUInt32LE(8),file.length);
 const jsonSize=file.readUInt32LE(12);
 const doc=JSON.parse(file.toString('utf8',20,20+jsonSize));
 const binStart=20+jsonSize+8;
 return {file,doc,binStart};
}
function rgbTexture({file,doc,binStart},name){
 const m=doc.materials.find(m=>m.name===name);
 assert.ok(m,'missing '+name);
 assert.ok(m.extensions?.KHR_materials_unlit,'team marking needs unlit sRGB');
 const texture=doc.textures[m.pbrMetallicRoughness.baseColorTexture.index];
 const image=doc.images[texture.source];
 const view=doc.bufferViews[image.bufferView];
 const data=file.subarray(binStart+view.byteOffset,binStart+view.byteOffset+view.byteLength);
 assert.equal(data.toString('hex',1,4),'504e47');
 const width=data.readUInt32BE(16),length=data.readUInt32BE(33);
 const raw=inflateSync(data.subarray(41,41+length));
 const p=Math.floor(width/2)*(width*4+1)+1+Math.floor(width/2)*4;
 return Array.from(raw.subarray(p,p+3));
}

test('both faction GLBs contain one hangar, two independent shutters and tower',()=>{
 for(const owner of [0,1]){
  const model=glb(owner),{doc,file}=model;
  assert.equal(doc.asset.generator,'sandforge-airfield-pbr-v1-20261116');
  assert.ok(file.byteLength>80_000&&file.byteLength<500_000);
  assert.equal(doc.nodes.filter(n=>n.name==='HangarDoorLeft_0').length,1);
  assert.equal(doc.nodes.filter(n=>n.name==='HangarDoorRight_0').length,1);
  assert.ok(doc.nodes.some(n=>n.name==='SF_Airfield_PBR_roof'));
  assert.ok(doc.nodes.some(n=>n.name==='SF_Airfield_PBR_glass'));
  assert.ok(doc.nodes.some(n=>n.name==='SF_Airfield_PBR_camo'));
  assert.equal(doc.scenes[doc.scene].nodes.length,1);
  assert.ok(doc.meshes.length<=20,'one GLB should stay light at RTS zoom');
  assert.deepEqual(rgbTexture(model,'Sandforge_Airfield_team'),factionRgb8(owner));
  const left=doc.nodes.find(n=>n.name==='HangarDoorLeft_0');
  const right=doc.nodes.find(n=>n.name==='HangarDoorRight_0');
  assert.deepEqual(left.translation,[-178,36,23]);
  assert.deepEqual(right.translation,[-124,36,23]);
  assert.notEqual(left.mesh,right.mesh);
  for(const node of [left,right]){
   const p=doc.meshes[node.mesh].primitives[0].attributes.POSITION;
   const acc=doc.accessors[p];
   assert.ok(acc.min[0]<=-26&&acc.max[0]>=26);
   assert.ok(acc.min[1]<=-32&&acc.max[1]>=32);
   assert.ok(acc.min[2]<=-2.5&&acc.max[2]>=4.1-1e-5);
  }
 }
});

test('new PBR model matches authoritative 3D single-hangar taxi coordinates',()=>{
 const flights=readFileSync('src/reborn/airfield-maintenance.ts','utf8');
 const gen=src('generate-airfield-pbr.mjs');
 assert.match(gen,/AIRFIELD_HANGAR_CENTER_X=-151/);
 assert.match(gen,/AIRFIELD_HANGAR_FRONT_Z=18/);
 assert.match(gen,/AIRFIELD_HANGAR_DOOR_CENTERS=Object\.freeze\(\[-178,-124\]\)/);
 assert.match(flights,/AIRFIELD_BAYS=1/);
 assert.match(flights,/dockX=\(_bay:AirfieldBay\)=>-151/);
 assert.match(flights,/door:\{x:dockX\(bay\),z:20\}/);
 assert.match(flights,/dock:\{x:dockX\(bay\),z:-117\}/);
 assert.match(flights,/AIRFIELD_COMPACT_X=\.90,AIRFIELD_COMPACT_Z=\.82,AIRFIELD_COMPACT_OFFSET_X=95/);
 const old=src('webgl-airfield-service.js');
 assert.match(old,/group\.scale\.set\(\.90,\.84,\.82\);group\.position\.x=95/);
 assert.match(old,/const cx=-151,half=59,front=18,rear=-171/);
});

test('flightline swaps PBR shutter references and keeps a safe fallback',()=>{
 const loader=src('webgl-airfield-pbr.js');
 assert.match(loader,/new GLTFLoader\(\)\.loadAsync\(url\)/);
 assert.match(loader,/data\.scene\.clone\(true\)/);
 assert.match(loader,/getObjectByName\('HangarDoorLeft_0'\)/);
 assert.match(loader,/getObjectByName\('HangarDoorRight_0'\)/);
 assert.match(loader,/gate\.left=left;gate\.right=right/);
 assert.match(loader,/gate\.open=Math\.max\(0,Math\.min\(1,gate\.open\)\)/);
 assert.match(loader,/group\.userData\.airfieldPbrDisposed/);
 assert.match(loader,/group\.userData\.airfieldPbrToken!==token/);
 assert.match(loader,/model\.removeFromParent\(\);releaseGhost\(model\)/);
 assert.match(loader,/airfieldGhostMaterials/);
 const yard=src('webgl-airfield-service.js');
 assert.match(yard,/ensureAirfieldPbr\(group,owner,\{ghost\}\)/);
 assert.match(yard,/ensureAirfieldPbr\(group,base\.owner\)/);
 assert.match(yard,/detachAirfieldPbr\(root\)/);
 assert.match(yard,/gate\.left\.position\.x=gate\.cx-27-28\*gate\.open/);
 assert.match(yard,/gate\.left\.scale\.y=gate\.right\.scale\.y=1-\.94\*gate\.open/);
 assert.match(yard,/entry\.detail\.visible=false/);
});

test('HUD, gameplay, construction ghost and standard build share the airfield assets',()=>{
 const game=src('webgl-battlefield.js'),hud=src('webgl-portraits.js');
 const build=src('build.mjs');
 assert.match(game,/createAirfieldServiceYard\(0,\{ghost:true\}\)/);
 assert.match(game,/createAirfieldServiceYard\(b\.owner\)/);
 assert.match(game,/detachAirfieldPbr\(preview\.userData\.previewService\)/);
 assert.match(game,/getObjectByName\('SF_Airfield_PBR_Root'\)/);
 assert.match(hud,/const authoredAirfield=kind==='airfield'/);
 assert.match(hud,/authoredFactory\|\|authoredAirfield/);
 assert.match(build,/scripts\/generate-airfield-pbr\.mjs/);
 assert.match(build,/dist\/webgl-airfield-pbr\.js/);
 const beforeAssets=build.indexOf("scripts/generate-airfield-pbr.mjs");
 const copyAssets=build.indexOf("cpSync('src/assets', 'dist/src/assets'");
 assert.ok(beforeAssets>=0&&copyAssets>beforeAssets);
});

test('reusing the existing runway keeps original flight dynamics and save schema',()=>{
 const simulation=readFileSync('src/reborn/airfield-maintenance.ts','utf8');
 assert.match(simulation,/AIRFIELD_LANDING_SECONDS=3\.4/);
 assert.match(simulation,/AIRFIELD_TAXI_SECONDS=8/);
 assert.match(simulation,/AIRFIELD_TAKEOFF_SECONDS=8/);
 assert.match(simulation,/AIRFIELD_REPAIR_HP_PER_CREDIT=4/);
 assert.match(simulation,/airfieldTaxiPoint\(/);
 const yard=src('webgl-airfield-service.js');
 assert.match(yard,/conformAirfieldSurface\(/);
 assert.match(yard,/AirfieldExtendedRunway/);
 assert.match(yard,/AirfieldRunwayCenterDash/);
 assert.match(yard,/AirfieldAircraftParkingPad_/);
});
