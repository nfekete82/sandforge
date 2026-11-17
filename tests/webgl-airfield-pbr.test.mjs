import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import vm from 'node:vm';
import {factionRgb8} from '../scripts/sandforge-faction-palette.js';
import {servicePaint} from '../scripts/webgl-service-materials.js';
import * as THREE from 'three';
import {createAirfieldServiceYard,disposeAirfieldServiceYard,hideOldAirfieldHangar} from '../scripts/webgl-airfield-service.js';
import {airfieldLaunchDuration,airfieldLaunchPose,airfieldLaunchLeg} from '../scripts/webgl-airfield-launch-path.js';
import {applyAirfieldRollup,AIRFIELD_ROLLUP_SLATS,AIRFIELD_ROLLUP_FIRST_Y,AIRFIELD_ROLLUP_STEP} from '../scripts/webgl-airfield-rollup.js';

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

test('both faction GLBs contain one hangar, 8 broad shutter panels and a radar tower',()=>{
 for(const owner of [0,1]){
  const model=glb(owner),{doc,file}=model;
  assert.equal(doc.asset.generator,'sandforge-airfield-pbr-v2-rollup-satellite-20261116');
  assert.ok(file.byteLength>80_000&&file.byteLength<750_000,
   'the complete coarse-panel roll-up/glazed-tower GLB remains under 750 KB');
  assert.equal(doc.nodes.filter(n=>/^HangarRollupSlat_0_\d{2}$/.test(n.name)).length,AIRFIELD_ROLLUP_SLATS);
  assert.equal(doc.nodes.filter(n=>n.name==='HangarRollupDrum_0').length,1);
  assert.equal(doc.nodes.filter(n=>n.name==='AirfieldTowerDishRotor').length,1);
  assert.ok(doc.nodes.some(n=>n.name==='SF_Airfield_PBR_roof'));
  assert.ok(doc.nodes.some(n=>n.name==='SF_Airfield_PBR_glass'));
  assert.ok(doc.nodes.some(n=>n.name==='SF_Airfield_PBR_camo'));
  assert.equal(doc.scenes[doc.scene].nodes.length,1);
  assert.ok(doc.meshes.length<=40,'textured single curtain plus dish stays light at RTS zoom');
  assert.deepEqual(rgbTexture(model,'Sandforge_Airfield_team'),factionRgb8(owner));
  const slats=doc.nodes.filter(n=>/^HangarRollupSlat_0_\d{2}$/.test(n.name));
  assert.equal(slats.length,AIRFIELD_ROLLUP_SLATS);
  for(const [i,node] of slats.entries()){
   assert.deepEqual(node.translation,[-151,AIRFIELD_ROLLUP_FIRST_Y+i*AIRFIELD_ROLLUP_STEP,26]);
   const p=doc.meshes[node.mesh].primitives[0].attributes.POSITION;
   const acc=doc.accessors[p];
   assert.ok(acc.min[0]<=-54.5&&acc.max[0]>=54.5);
   assert.ok(acc.max[1]-acc.min[1]>7.8&&acc.max[1]-acc.min[1]<8.01);
   assert.ok(acc.max[2]-acc.min[2]>=3.79);
  }
  const rotor=doc.nodes.find(n=>n.name==='AirfieldTowerDishRotor');
  assert.deepEqual(rotor.translation,[-269,128,-81]);
  assert.ok(rotor.children.length>=1);
  assert.ok(doc.materials.some(m=>m.name==='Sandforge_Airfield_door_corrugated'));
  assert.ok(doc.materials.some(m=>m.name==='Sandforge_Airfield_gate_frame'));
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
 assert.match(loader,/getObjectByName\('HangarRollupSlat_0_'/);
 assert.match(loader,/getObjectByName\('HangarRollupDrum_0'\)/);
 assert.match(loader,/getObjectByName\('AirfieldTowerDishRotor'\)/);
 assert.match(loader,/gate\.slats=slats;gate\.drum=drum/);
 assert.match(loader,/applyAirfieldRollup\(gate,gate\.open\)/);
 assert.match(loader,/group\.userData\.airfieldPbrDisposed/);
 assert.match(loader,/group\.userData\.airfieldPbrToken!==token/);
 assert.match(loader,/model\.removeFromParent\(\);releaseGhost\(model\)/);
 assert.match(loader,/airfieldGhostMaterials/);
 const yard=src('webgl-airfield-service.js');
 assert.match(yard,/ensureAirfieldPbr\(group,owner,\{ghost\}\)/);
 assert.match(yard,/ensureAirfieldPbr\(group,base\.owner\)/);
 assert.match(yard,/detachAirfieldPbr\(root\)/);
 assert.match(yard,/applyAirfieldRollup\(gate,gate\.open\)/);
 assert.match(yard,/gate\.left\.position\.x=gate\.cx-27;/);
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

test('runway black trio was three buried taxi dashes: no cosmetic guide now crosses asphalt',()=>{
 const yard=createAirfieldServiceYard(0);
 const runway=yard.getObjectByName('AirfieldExtendedRunway');
 assert.ok(runway?.isMesh);
 const leftEdge=runway.position.x-runway.geometry.parameters.width/2;
 assert.equal(leftEdge,-58.5);
 const guides=yard.children.filter(m=>m.name==='AirfieldTaxiCrossGuide'||
  m.name==='AirfieldTaxiGuideDash');
 assert.equal(guides.length,4,'only one clipped yellow guide and three dashes OUTSIDE the runway');
 for(const guide of guides){
  const right=guide.position.x+guide.geometry.parameters.width/2;
  assert.ok(right<leftEdge-1,guide.name+' must stop BEFORE the asphalt edge');
 }
 const srcText=src('webgl-airfield-service.js');
 assert.match(srcText,/for\(const x of \[-158,-126,-94\]\)/);
 assert.doesNotMatch(srcText,/for\(const x of \[-158,-126,-94,-62,-30,2\]\)/);
 assert.doesNotMatch(srcText,/AirfieldConcreteJoint/);
 // The original imported GLB must not layer old unlabelled black skids
 // above the actual service-yard runway, even if it has newer mesh names.
 const detail=new THREE.Group();
 detail.name='OriginalAirfieldDetail';
 detail.add(new THREE.Mesh(new THREE.BoxGeometry(10,2,4),
  new THREE.MeshBasicMaterial({color:'#101513'})));
 const entry={detail};
 hideOldAirfieldHangar(entry);
 assert.equal(detail.visible,false,'hide entire duplicate airfield GLB, not only a few named parts');
 assert.equal(entry.airfieldOldHidden,true);
 detail.children[0].geometry.dispose();detail.children[0].material.dispose();
 disposeAirfieldServiceYard({airfieldServiceYard:yard});
});

test('tower window has NO colored badge, but hangar keeps blue/red faction markings',()=>{
 const source=src('generate-airfield-pbr.mjs');
 assert.doesNotMatch(source,/box\('team',\[towerX,112,towerZ\+23\.8\]/);
 assert.doesNotMatch(source,/if\(key==='camo'\)\{const blob=Math\.sin/);
 for(const owner of [0,1]){
  const model=glb(owner);
  const points=meshPoints(model,'SF_Airfield_PBR_team');
  assert.ok(points.length>=24,'hangar must retain team stripes and gate flags');
  assert.equal(points.filter(([x,y,z])=>
   Math.abs(x+269)<35&&y>95&&Math.abs(z+81)<35).length,0,
   'tower observation deck must stay clear of faction-blue/red rectangles');
 }
});

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


test('flightline concrete uses small uniform slab aggregates, never camouflage blobs',()=>{
 const service=src('webgl-airfield-service.js'),paint=src('webgl-service-materials.js');
 assert.match(service,/const wornPaving=servicePaint\([^\n]*\{pattern:'slab'/);
 assert.match(service,/const apronWear=servicePaint\([\s\S]*?\{pattern:'slab',seed:67/);
 assert.match(service,/const rampGrip=servicePaint\([\s\S]*?\{pattern:'slab',seed:25/);
 assert.match(service,/const runwayWear=servicePaint\([^\n]*\{pattern:'asphalt'/);
 assert.match(paint,/const idx=slab\|\|asphalt\?1/);
 const material=servicePaint(['#82817a','#aaa69f','#c3beb5'],{pattern:'slab',seed:39});
 const d=material.map.image.data;
 const side=material.map.image.width;
 assert.equal(side,256,'fine shared service materials use 256px albedo');
 const value=(x,y)=>d[(y*side+x)*4];
 assert.ok(Math.abs(value(18,18)-value(19,18))<22,'no large irregular swatches');
 assert.ok(value(64,18)<value(62,18)-10,'fine visible concrete panel joint');
 assert.equal(material.normalMap?.isDataTexture,true,'microrelief PBR normal map exists');
 assert.equal(material.normalMap.image.width,256);
 material.map.dispose();material.normalMap.dispose();material.dispose();
});

test('tower has a circular shaft, 360-degree glazing and a round roof',()=>{
 const generator=src('generate-airfield-pbr.mjs');
 assert.match(generator,/export const AIRFIELD_TOWER_SIDES=20/);
 assert.match(generator,/function cylindricalShell\(/);
 assert.match(generator,/cylindricalShell\('camo',towerX,towerZ,17\.5,17\.5,6,93/);
 assert.match(generator,/cylindricalShell\('glass',towerX,towerZ,23,23,97\.5,117\.5\)/);
 assert.match(generator,/cylindricalShell\('roof',towerX,towerZ,27\.0,27\.0,119\.5,124/);
 assert.match(generator,/for\(let i=0;i<AIRFIELD_TOWER_SIDES;i\+\+\)/);
 assert.match(generator,/alphaMode:'BLEND'/);
 assert.match(generator,/scan\[i\+3\]=key==='glass'\?142:255/);
 assert.doesNotMatch(generator,/box\('glass',\[towerX,106,z\]/);
 assert.doesNotMatch(generator,/box\('roof',\[towerX,120,towerZ\]/);
});

test('three dark transverse parking-apron strokes are absent in built and ghost airfields',()=>{
 const source=src('webgl-airfield-service.js');
 assert.doesNotMatch(source,/AirfieldConcreteJoint/,'old three apron stripes must not be regenerated');
 // The parking pad, taxi guide and runway remain usable; only three dark
 // cosmetic cross-bars go away. The ghost uses this exact same generator.
 for(const ghost of [false,true]){
  const yard=createAirfieldServiceYard(0,{ghost});
  const names=[];
  yard.traverse(node=>{if(node.isMesh)names.push(node.name);});
  assert.ok(names.some(name=>name.startsWith('AirfieldAircraftParkingPad_')));
  assert.ok(names.some(name=>name==='AirfieldExtendedRunway'));
  assert.ok(names.some(name=>name==='AirfieldTaxiCrossGuide'));
  assert.equal(names.filter(name=>name.startsWith('AirfieldConcreteJoint')).length,0);
  disposeAirfieldServiceYard({airfieldServiceYard:yard});
 }
});

test('runway has no raised black rubber/debris strips, but retains safe markings',()=>{
 const service=src('webgl-airfield-service.js');
 assert.doesNotMatch(service,/box\(group,'AirfieldTouchdownRubber'/);
 assert.doesNotMatch(service,/for\(const x of \[-11,33\]\)/);
 assert.match(service,/AirfieldRunwayCenterDash/);
 assert.match(service,/AirfieldRunwayThreshold/);
 assert.match(service,/AirfieldRunwayEdgeLine/);
 assert.match(service,/AirfieldRunwayLandingBars/);
});

test('bomber taxis from actual hangar via apron then lifts off from runway',()=>{
 const total=airfieldLaunchDuration('bomber');
 assert.ok(total>10&&total<12);
 assert.equal(airfieldLaunchPose('bomber',0).visible,false);
 const p=airfieldLaunchPose('bomber',3);
 assert.equal(p.stage,'taxi');
 assert.deepEqual([airfieldLaunchLeg('bomber',p).from,airfieldLaunchLeg('bomber',p).to],['dock','door']);
 const takeoff=airfieldLaunchPose('bomber',8.8);
 assert.equal(takeoff.stage,'takeoff');
 assert.ok(takeoff.lift>0&&takeoff.lift<1);
 assert.deepEqual([airfieldLaunchLeg('bomber',takeoff).from,airfieldLaunchLeg('bomber',takeoff).to],['taxi','departure']);
 assert.ok(airfieldLaunchPose('bomber',total+.02).done);
});

test('transport helicopter clears hangar, then rises vertically on apron',()=>{
 const duration=airfieldLaunchDuration('scout');
 assert.ok(duration>7&&duration<8);
 const pose=airfieldLaunchPose('scout',5.2);
 assert.equal(pose.stage,'takeoff');
 assert.deepEqual(airfieldLaunchLeg('scout',pose),{from:'lineup',to:'lineup',t:1});
 assert.ok(pose.lift>0&&pose.lift<1);
 assert.ok(airfieldLaunchPose('scout',duration+.01).done);
 assert.equal(airfieldLaunchPose('infantry',0),null);
});

test('real paid air units use one animation event and a lawful exterior handoff',()=>{
 const simulation=readFileSync('src/reborn/simulation.ts','utf8');
 assert.match(simulation,/if\(!spawn&&this\.stageWebGLProduction&&b\.kind==='airfield'/);
 assert.match(simulation,/airfieldPoint\(b,kind==='bomber'\?'departure':'lineup'\)/);
 assert.match(simulation,/spawn=point;stagedAirfield=true/);
 assert.match(simulation,/this\.productionDepartureHolds\.set\(u\.id,this\.time\+\(stagedAirfield/);
 const launch=src('webgl-airfield-launch.js'),battle=src('webgl-battlefield.js'),build=src('build.mjs');
 assert.match(launch,/const actor=bf\.units\.get\(event\.unitId\)/);
 assert.match(launch,/this\.seen=new WeakSet\(this\.game\.productionReleases\)/);
 assert.match(launch,/this\.active\.has\(base\.id\)/);
 assert.match(launch,/for\(const event of active\?game\.productionReleases:\[\]\)/,
  'tactical pause may render existing launch but never begin another');
 assert.match(launch,/const time=game\.time-\(active\?\.05\*\(1-clamp\(alpha\)\):0\)/,
  'taxi route should interpolate smoothly at high display refresh rates');
 assert.match(launch,/actor\.node\.position\.copy\(worldPoint\)/);
 assert.match(launch,/this\.game\.cancelProductionDeparture\?\.\(state\.event\.unitId\)/);
 assert.doesNotMatch(launch,/\.spawn\(/,'no second dummy unit may be created');
 assert.match(battle,/this\.airfieldLaunch=new SandforgeAirfieldLaunch\(this\)/);
 assert.match(battle,/this\.airfieldLaunch\.update\(active,blend\)/);
 assert.match(build,/dist\/webgl-airfield-launch\.js/);
 assert.match(build,/dist\/webgl-airfield-launch-path\.js/);
 const service=src('webgl-airfield-service.js');
 assert.match(service,/group\.userData\.airfieldProductionOpen\?\?0/);
 assert.match(src('webgl-preview.js'),/battlefield\.airfieldLaunch\.dispose\(\)/);
});


test('real launch presenter freezes during Space pause and resumes at exact Simulation position',()=>{
 const file=src('webgl-airfield-launch.js');
 const code=file.replace(/^import .*?;\s*$/gm,'').replace(/^export /gm,'')+
  '\nthis.Launch=SandforgeAirfieldLaunch;';
 const base={id:20,owner:0,kind:'airfield',hp:1200,buildRemaining:0,
  x:800,y:800,facing:0};
 const point=(b,waypoint)=>{
  const local={dock:[-151,-117],door:[-151,20],lineup:[-151,95],
   taxi:[12,95],departure:[12,225]}[waypoint];
  return {x:b.x+95+local[0]*.9,y:b.y+local[1]*.82};
 };
 const context={
  airfieldPoint:point,unitVisualYaw:(kind,heading)=>Math.PI/2-heading,
  airfieldLaunchDuration,airfieldLaunchPose,airfieldLaunchLeg,
  console,WeakSet,Map,Set,Math
 };
 vm.createContext(context);
 vm.runInContext(code,context);
 const spawn=point(base,'departure');
 const unit={id:51,kind:'bomber',owner:0,hp:700,x:spawn.x,y:spawn.y,
  orders:[]};
 const node={visible:true,rotation:{y:0},position:{x:0,y:0,z:0,
  copy(v){Object.assign(this,v);}}};
 const actor={node,productionMotion:null};
 const yard={userData:{airfieldProductionOpen:0}};
 const baseEntry={node:{visible:true},airfieldServiceYard:yard};
 const released=[];
 const game={time:0,stageWebGLProduction:true,productionReleases:[],
  units:[unit],bases:[base],canSee:()=>true,
  extendProductionDeparture(){},cancelProductionDeparture:id=>released.push(id)};
 const field={game,bases:new Map([[base.id,baseEntry]]),
  units:new Map([[unit.id,actor]]),world:{size:2000},
  heightAt:()=>0,pos:(x,z,y)=>({x:x-1000,z:z-1000,y}),
  entityPosition:u=>({x:u.x-1000,z:u.y-1000,y:175})};
 const presenter=new context.Launch(field);
 game.productionReleases.push({unitId:unit.id,baseId:base.id,
  kind:'bomber',owner:0,at:0});
 presenter.update(true,1);
 assert.equal(node.visible,false,'the bomber must begin behind shut doors');
 game.time=4;presenter.update(true,1);
 assert.ok(node.visible,'bomber should now taxi through the open hangar');
 assert.equal(yard.userData.airfieldProductionOpen,1);
 const x=node.position.x,z=node.position.z;
 presenter.update(false,1);
 assert.equal(node.position.x,x,'pause does not teleport actor to runway');
 assert.equal(node.position.z,z);
 assert.equal(presenter.active.size,1);
 game.time=8.4;presenter.update(true,.5);
 assert.ok(node.position.y>7,'bomber should now be climbing');
 game.time=12;presenter.update(true,1);
 assert.equal(node.position.x,spawn.x-1000,'handoff must match exact real Unit');
 assert.equal(node.position.z,spawn.y-1000);
 assert.equal(presenter.active.size,0);
 assert.equal(yard.userData.airfieldProductionOpen,0);
 assert.deepEqual(released,[unit.id]);
 assert.equal(unit.x,spawn.x,'Simulation never rewrites unit position for animation');
 assert.equal(unit.y,spawn.y);
});

test('roll-up stays centered, opens UP to full bomber clearance and closes symmetrically',()=>{
 const gate={cx:-151,open:0,slats:Array.from({length:AIRFIELD_ROLLUP_SLATS},()=>({
   position:{x:0,y:0},scale:{y:1},visible:true
  })),drum:{rotation:{x:0}}};
 applyAirfieldRollup(gate,0);
 assert.ok(gate.slats.every((s,i)=>s.position.x===-151&&s.position.y===AIRFIELD_ROLLUP_FIRST_Y+i*AIRFIELD_ROLLUP_STEP));
 assert.equal(gate.slats.filter(s=>s.visible).length,AIRFIELD_ROLLUP_SLATS);
 applyAirfieldRollup(gate,.5);
 assert.ok(gate.slats[0].position.y>AIRFIELD_ROLLUP_FIRST_Y&&gate.slats[0].position.y<70);
 assert.ok(gate.slats.filter(s=>s.visible).length<AIRFIELD_ROLLUP_SLATS);
 assert.ok(gate.slats.every(s=>s.position.x===-151&&s.scale.y===1));
 applyAirfieldRollup(gate,1);
 assert.ok(gate.slats.every(s=>!s.visible),'all broad metal panels are rolled up');
 assert.ok(gate.drum.rotation.x<0,'top drum rotates with rising door');
 applyAirfieldRollup(gate,0);
 assert.ok(gate.slats.every(s=>s.visible));
 assert.equal(gate.drum.rotation.x,0);
});
test('tower glass wraps 360 degrees and Bastion-style radar rotates only when active',()=>{
 const service=src('webgl-airfield-service.js');
 const pbr=src('webgl-airfield-pbr.js');
 const generator=src('generate-airfield-pbr.mjs');
 assert.match(generator,/cylindricalShell\('glass',towerX,towerZ,23,23,97\.5,117\.5\)/);
 assert.match(generator,/export const AIRFIELD_RADAR_STYLE='bastion-flat-rectangular-scanner-v1'/);
 assert.match(generator,/bastionStyleRadar\(\)/);
 assert.doesNotMatch(generator,/satelliteDish\(/);
 assert.match(generator,/box\('steel_dark',\[0,15\.0,0\],\[27\.5,13\.2,1\.6\],0,part\)/);
 assert.match(generator,/for\(let i=0;i<9;i\+\+\)/);
 assert.match(pbr,/group\.userData\.airfieldDishRotor=rotor/);
 assert.match(service,/if\(rotor&&active&&dt>0\)rotor\.rotation\.y\+=dt\*\.44/);
 assert.match(src('webgl-battlefield.js'),/updateAirfieldServiceYard\(entry,b,this\.game\.units,this\.game\.time,dt,active\)/);
 const build=src('build.mjs');
 assert.match(build,/dist\/webgl-airfield-rollup\.js/);
});
