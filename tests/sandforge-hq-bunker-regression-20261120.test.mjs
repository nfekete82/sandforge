import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {RULES} from '../dist/src/reborn/config.js';
import {UNITS,BUILDINGS} from '../dist/src/reborn/catalog.js';
import {enhanceMilitaryMicroPBR,militarySurfaceRole}
 from '../scripts/webgl-military-micro-pbr.js';

function createArena(){
 const g=Simulation.campaign(824836862,24,'mixed',4);
 g.aiClock=-1e8;g.tactical.plan=()=>{};
 const p=g.world.nearest({x:g.world.size*.37,y:g.world.size*.37},
  g.obstacles(),[],undefined,100);
 assert.ok(p);
 const b={id:788888,owner:0,kind:'bunker',...p,hp:BUILDINGS.bunker.hp,
  queue:[],queueTypes:[],queueCosts:[],production:0,buildRemaining:0,
  cooldown:0,rally:null,radius:BUILDINGS.bunker.radius,territory:0,garrison:[]};
 g.bases.push(b);
 return {g,b};
}
test('HQ authored 3D materials are unchanged; only vehicle shells get optional micro-PBR',()=>{
 const root=new THREE.Group();
 const originalMap=new THREE.DataTexture(new Uint8Array([214,183,132,255]),1,1);
 const originalNormal=new THREE.DataTexture(new Uint8Array([128,128,255,255]),1,1);
 const originalRough=new THREE.DataTexture(new Uint8Array([225,225,225,255]),1,1);
 const mat=new THREE.MeshStandardMaterial({
  name:'HQ_OriginalConcreteWalls',map:originalMap,normalMap:originalNormal,
  roughnessMap:originalRough,color:'#c8b595',metalness:.11,roughness:.83
 });
 mat.userData.sandforgeBuildingPBRRevision='authored-original';
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(30,20,4),mat);
 mesh.name='HQ_Static_SF_OriginalPBR_walls';
 root.add(mesh);
 const shader=mat.onBeforeCompile;
 const key=mat.customProgramCacheKey();
 const color=mat.color.getHex();
 const input=[mat,originalMap,originalNormal,originalRough];
 assert.equal(militarySurfaceRole('headquarters','building',mesh.name,mat.name,mat),null);
 assert.equal(militarySurfaceRole('barracks','building','Wall',mat.name,mat),null);
 assert.equal(militarySurfaceRole('factory','building','SF_Factory_PBR_wall',mat.name,mat),null);
 assert.equal(militarySurfaceRole('tank','unit','Tank_HullArmour',mat.name,mat),'armour');
 const result=enhanceMilitaryMicroPBR(root,{type:'building',kind:'headquarters'});
 assert.equal(result.materials,0);
 assert.equal(mesh.material,input[0]);
 assert.equal(mesh.material.map,input[1]);
 assert.equal(mesh.material.normalMap,input[2]);
 assert.equal(mesh.material.roughnessMap,input[3]);
 assert.equal(mesh.material.onBeforeCompile,shader);
 assert.equal(mesh.material.customProgramCacheKey(),key);
 assert.equal(mesh.material.color.getHex(),color);
 assert.equal(mesh.material.userData.sandforgeMilitaryMicroPBR,undefined);
 root.children[0].geometry.dispose();mat.dispose();
 for(const tex of [originalMap,originalNormal,originalRough])tex.dispose();
});

test('normal, heavy and rocket infantry can ALL request their five bunker places',()=>{
 const {g,b}=createArena();
 const kinds=['infantry','heavy','rocket','infantry','heavy','rocket'];
 const members=kinds.map((kind,i)=>g.spawn(0,{
  x:b.x+114+(i%3)*.2,y:b.y+(i%3)*1.6
 },kind));
 assert.deepEqual(kinds.slice(0,3).map(k=>UNITS[k].group),['Infanterie','Infanterie','Infanterie']);
 const accepted=g.boardBunker(b.id,members.map(u=>u.id));
 assert.equal(accepted,5,'5 slots with different soldier types');
 for(let i=0;i<120;i++)g.step(RULES.tick);
 assert.equal(b.garrison.length,5);
 for(const k of ['infantry','heavy','rocket']){
  assert.ok(members.some(u=>u.kind===k&&u.carrier===b.id),
   'missing soldier type '+k);
 }
 assert.equal(members[5].carrier,undefined,'sixth seat is never free');
});

test('infantry can travel to a bunker from ordinary outdoor positions, not just start at its door',()=>{
 const {g,b}=createArena();
 const kinds=['infantry','heavy','rocket'];
 const candidates=[
  {x:b.x+240,y:b.y+12},{x:b.x+250,y:b.y+40},
  {x:b.x+265,y:b.y-28}
 ];
 const members=kinds.map((kind,i)=>{
  const start=g.world.nearest(candidates[i],
   [...g.obstacles(),...[]],[],undefined,12);
  assert.ok(start,'valid outside map navigation start');
  return g.spawn(0,start,kind);
 });
 assert.equal(g.boardBunker(b.id,members.map(u=>u.id)),3);
 for(let i=0;i<360;i++)g.step(RULES.tick);
 const admitted=members.filter(u=>u.carrier===b.id);
 assert.equal(admitted.length,3,
  'every rifle, heavy and rocket infantry must physically walk from outside and enter');
});

test('Bunker right-click detection is independent of other units overlapping the target',()=>{
 const source=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(source,/bunkerAtPointer\(event\)/);
 assert.match(source,/const bunker=this\.bunkerAtPointer\(event\)/);
 assert.match(source,/new THREE\.Box3\(\)\.setFromObject\(node\)/);
 assert.match(source,/ray\.ray\.intersectBox\(bounds,new THREE\.Vector3\(\)\)/);
 assert.match(source,/UNITS\[u\.kind\]\.group==='Infanterie'/);
 assert.match(source,/this\.game\.boardBunker\(bunker\.id,ids\)/);
 assert.doesNotMatch(source,/const bunker=hit\?\.type==='base'&&hit\.entity\.kind==='bunker'/);
 assert.match(source,/if\(type==='unit'&&entry\.kind!=='bomber'\)\s+entry\.microSurface=enhanceMilitaryMicroPBR/);
});
