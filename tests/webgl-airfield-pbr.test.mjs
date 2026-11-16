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
 assert.match(hud,/DESERT_BUILDING_KINDS\.includes\(kind\)\|\|kind==='airfield'/);
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


function meshPoints(model,nodeName){
 const {doc,file,binStart}=model;
 const node=doc.nodes.find(n=>n.name===nodeName);
 assert.ok(node?.mesh!==undefined,'Missing authored mesh '+nodeName);
 const primitive=doc.meshes[node.mesh].primitives[0];
 const accessor=doc.accessors[primitive.attributes.POSITION];
 const view=doc.bufferViews[accessor.bufferView];
 assert.equal(accessor.type,'VEC3');
 const stride=view.byteStride||12;
 const start=binStart+view.byteOffset+(accessor.byteOffset||0);
 const points=[];
 for(let i=0;i<accessor.count;i++){
  const at=start+i*stride;
  points.push([file.readFloatLE(at),file.readFloatLE(at+4),file.readFloatLE(at+8)]);
 }
 return points;
}

test('new barrel roof is continuous corrugated steel with its own embedded 256px texture',()=>{
 const gen=src('generate-airfield-pbr.mjs');
 assert.match(gen,/export const AIRFIELD_ROOF_SEGMENTS=108/);
 assert.match(gen,/ROOF_BASE_Y=73,ROOF_RISE=35/);
 assert.match(gen,/box\('stone',\[x,107,-105\]/,'vents must sit ON the curved roof');
 assert.match(gen,/barrelRoof\(cx\)/);
 assert.doesNotMatch(gen,/const panel= j%3/,'retired floating plate roof must stay removed');
 for(const owner of [0,1]){
  const model=glb(owner);
  const points=meshPoints(model,'SF_Airfield_PBR_roof_corrugated');
  assert.ok(points.length>=600,'continuous curved roof surface');
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),zs=points.map(p=>p[2]);
  assert.ok(Math.max(...xs)-Math.min(...xs)>=120,'full hangar width');
  assert.ok(Math.max(...ys)-Math.min(...ys)>=25,'pronounced rounded Quonset barrel vault, not a flat plate');
  assert.ok(Math.min(...ys)>75,'curved eaves must clear the full-size hangar doorway');
  assert.ok(Math.min(...zs)<=-173&&Math.max(...zs)>=20);
  const teamPaint=meshPoints(model,'SF_Airfield_PBR_team')
   .filter(([x,y,z])=>y>84&&z<0&&x>-215&&x<-85);
  assert.ok(teamPaint.length>=48,'curved blue/red bands on both sides');
  assert.ok(teamPaint.every(([x,y,z])=>z<=-126+1e-3||z>=-74-1e-3),
   'never paint across the two raised ventilation modules');
  const mat=model.doc.materials.find(m=>m.name==='Sandforge_Airfield_roof_corrugated');
  assert.ok(mat,'dedicated corrugated roof PBR material');
  assert.ok(mat.pbrMetallicRoughness.roughnessFactor>=.88);
  const imageId=model.doc.textures[mat.pbrMetallicRoughness.baseColorTexture.index].source;
  const view=model.doc.bufferViews[model.doc.images[imageId].bufferView];
  const png=model.file.subarray(model.binStart+view.byteOffset,
   model.binStart+view.byteOffset+view.byteLength);
  assert.equal(png.readUInt32BE(16),256,'dedicated detailed corrugated albedo');
  assert.equal(png.readUInt32BE(20),256);
  const data=inflateSync(png.subarray(41,41+png.readUInt32BE(33)));
  const sample=[];
  for(let x=0;x<256;x++){
   const offset=128*(256*4+1)+1+x*4;sample.push(data[offset]);
  }
  assert.ok(Math.max(...sample)-Math.min(...sample)>25,
   'physically recognizable ribs, seams and muted weathering in the texture');
 }
});

test('runway is 15 percent longer and has no mast in the aircraft corridor',()=>{
 const flight=src('webgl-airfield-service.js');
 assert.match(flight,/export const AIRFIELD_RUNWAY_LENGTH=484/);
 assert.match(flight,/AIRFIELD_RUNWAY_CENTER_Z=35/);
 assert.match(flight,/AirfieldExtendedRunway',141,1\.6,AIRFIELD_RUNWAY_LENGTH/);
 assert.match(flight,/AirfieldRunwaySandShoulder',154,\.7,AIRFIELD_RUNWAY_LENGTH\+18/);
 assert.match(flight,/AirfieldRunwayEdgeLine',2,\.12,AIRFIELD_RUNWAY_LENGTH-4/);
 assert.match(flight,/for\(let z=-190;z<=270;z\+=42\)/);
 assert.match(flight,/for\(const z of \[-193,-182,-171\]\)/);
 assert.match(flight,/for\(const z of \[222,234,246,258\]\)/);
 assert.doesNotMatch(flight,/for\(const x of \[-204,28\]\)/,
  'no tall landing-strip obstruction at x=28,z=32');
 assert.match(flight,/const serviceLampX=-204/,'side service lamp remains');
 const rules=readFileSync('src/reborn/airfield-maintenance.ts','utf8');
 assert.match(rules,/approach:\{x:12,z:225\},touchdown:\{x:12,z:130\}/);
 assert.match(rules,/AIRFIELD_LANDING_SECONDS=3\.4/);
 assert.match(rules,/AIRFIELD_TAKEOFF_SECONDS=8/);
});
