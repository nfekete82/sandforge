import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {SandforgeProductionGates,GATE_TIMING} from '../scripts/webgl-production-gates.js';

function makeScenario(kind,rally){
 const detail=new THREE.Group(),node=new THREE.Group();
 const pbr=kind==='headquarters';
 for(const name of (pbr?
  ['HQ_door_leaf_L','HQ_door_leaf_R','HQ_door_recess_back']:
  ['door_leaf_L','door_leaf_R','door_recess_back'])){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1),
   new THREE.MeshStandardMaterial());
  mesh.name=name;detail.add(mesh);
 }
 detail.scale.setScalar(pbr?13:12);node.add(detail);
 const base={id:81,kind,owner:0,hp:1200,facing:0,x:1000,y:1000,
  rally:rally?{x:1000,y:1700}:null};
 const role=pbr?'engineer':'infantry';
 const unit={id:91,kind:role,owner:0,hp:110,x:1000,y:1150,
  angle:Math.PI/2,orders:rally?[{kind:'attackMove',x:1000,y:1700}]:[],
  fire:0,combatTarget:null,walkDistance:0,moving:false};
 const event={baseId:81,unitId:91,kind:role,owner:0,at:10,
  from:{x:1000,y:1000},to:{x:1000,y:1150}};
 const actor={node:new THREE.Group()};
 const canceled=[],extended=[];
 const game={time:10,bases:[base],units:[unit],productionReleases:[],
  stageWebGLProduction:true,
  cancelProductionDeparture:id=>canceled.push(id),
  extendProductionDeparture:(id,until)=>extended.push({id,until})};
 const bf={game,world:{size:2000,walkable:()=>true},
  bases:new Map([[81,{node,detail,kind}]]),units:new Map([[91,actor]]),
  renderer:{localClippingEnabled:false},heightAt:()=>0,
  entityPosition:()=>new THREE.Vector3(0,0,150)};
 const gates=new SandforgeProductionGates(bf);
 game.productionReleases.push(event);
 function step(age){
  game.time=10+age;
  actor.node.visible=true;
  actor.node.position.set(0,0,150);
  actor.productionMotion=null;
  gates.update(true,1);
  return actor.node.position.clone();
 }
 return {step,game,actor,gates,canceled,extended,base,unit};
}
for(const kind of ['barracks','headquarters'])for(const rally of [false,true]){
 test(kind+' '+(rally?'with rally':'without rally')+' walks smoothly, no sprint or delayed handoff',()=>{
  const f=makeScenario(kind,rally);
  f.step(0);
  const state=f.gates.active.get(81);
  assert.ok(state?.directFoot,'actual front staging must use the direct foot route');
  assert.ok(state.walkStart&&state.walkExit);
  assert.ok(state.duration>.7&&state.duration<1.65,
   'duration follows distance at 105 units/s, not the legacy 2.8s sprint');
  assert.ok(f.extended.length>0);
  const start=GATE_TIMING.warning+GATE_TIMING.opening;
  const times=[start+.05,start+.10,start+.15,start+.20,start+.25,start+.30,
   start+.35,start+.40,start+.45,start+.50,start+.55,start+.60];
  const positions=times.map(time=>f.step(time));
  for(let i=1;i<positions.length;i++){
   const step=positions[i].distanceTo(positions[i-1]);
   assert.ok(step>3.3&&step<5.7,
    'foot movement must remain near 105 units/s, step '+i+' was '+step);
  }
  assert.equal(f.actor.productionMotion?.moving,true);
  const end=f.step(start+state.duration+.008);
  assert.ok(end.distanceTo(new THREE.Vector3(0,0,150))<.00001,
   'portrait must finish exactly at authoritative simulation position');
  assert.deepEqual(f.canceled,[91],
   'release the held unit when it reaches the real position, before shutter closes');
  assert.equal(f.gates.active.size,1,
   'door may still be closing; movement must no longer be held');
  if(rally)assert.equal(f.actor.productionMotion?.moving,true,
   'walking clip must remain active during the first 20Hz rally step');
  else assert.equal(f.actor.productionMotion,null,
   'without rally, the unit idles immediately in front of the building');
  f.step(start+state.duration+.06);
  assert.deepEqual(f.canceled,[91],'handoff occurs only once');
  if(rally)assert.equal(f.actor.productionMotion?.moving,true,
   'rally foot cycle must not flash idle during handoff');
  f.step(start+state.duration+.16);
  assert.equal(f.actor.productionMotion,null,
   'after two simulation ticks, the real unit controls its own movement');
  f.step(start+state.duration+GATE_TIMING.closing+.20);
  assert.equal(f.gates.active.size,0);
  f.gates.dispose();
 });
}
test('foot animation uses normal idle/walk cadence through the handoff',()=>{
 const source=readFileSync('scripts/webgl-actor-presentation.js','utf8');
 assert.match(source,/entry\.productionMotion&&moving[\s\S]*?\?infantry\.has\(entity\.kind\)\?1:/);
 assert.ok(source.includes("clamp((entity.driveSpeed??80)/80,.15,3)"),
  'original rolling-speed scaling must remain for vehicles');
});
test('only foot units get the continuous direct path; factory rollouts remain intact',()=>{
 const source=readFileSync('scripts/webgl-production-gates.js','utf8');
 assert.match(source,/const directFoot=infantry&&turn<\.72/);
 assert.match(source,/const duration=directFoot\?/);
 assert.match(source,/if\(state\.directFoot\)/);
 assert.match(source,/if\(\(gate\.kind==='barracks'\|\|gate\.kind==='headquarters'\)&&!state\.released\)/);
 assert.match(source,/const safeDistance=infantry\?24:48/);
});
