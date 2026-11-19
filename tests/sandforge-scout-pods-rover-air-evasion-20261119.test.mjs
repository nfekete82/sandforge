import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {loneRoverAirDisengage} from '../dist/src/reborn/ai36-air-support.js';
import {attachScoutRocketPods,detachScoutRocketPods} from '../scripts/webgl-scout-rocket-pods.js';

test('two sleek rocket tubes per side, moved outside body instead of bulky boxes',()=>{
 const entry={kind:'scout',owner:0,node:new THREE.Group()};
 attachScoutRocketPods(entry);
 const root=entry.scoutRocketPods;
 assert.equal(root.children.length,2,'exactly one pod on each side');
 assert.equal(entry.scoutRocketMuzzles.length,2);
 assert.ok(root.children[0].position.x<0&&root.children[1].position.x>0);
 for(const pod of root.children){
  assert.ok(Math.abs(pod.position.x)>=35,'pods farther out on fuselage');
  const tubes=pod.children.filter(c=>c.isMesh&&c.geometry?.type==='CylinderGeometry'&&
    c.material?.color?.getHexString()==='1d2420');
  assert.equal(tubes.length,2,'two visible rocket bores, not three');
  assert.ok(pod.position.z<0,'mounted aft of the cockpit, not below the nose');
 }
 detachScoutRocketPods(entry);
 assert.equal(entry.node.children.length,0);
});

test('only a visible, unsupported Humvee vs helicopter may disengage',()=>{
 const yes={roverKind:'rover',enemyKind:'scout',enemyVisible:true,
  distance:190,aaCover:false};
 assert.equal(loneRoverAirDisengage(yes),true);
 for(const bad of [
  {roverKind:'tank'},{roverKind:'artillery'}, {enemyKind:'bomber'},
  {enemyVisible:false},{distance:501},{aaCover:true}
 ])assert.equal(loneRoverAirDisengage({...yes,...bad}),false,JSON.stringify(bad));
});

function skirmish(){
 const g=new Simulation(20261119,24);
 g.world.blocked.fill(0);
 g.world.opaque.fill(0);
 g.world.cliffIds.fill(-1);
 g.world.components.fill(0);
 g.units=[];
 const rover=g.spawn(1,{x:1600,y:1600},'rover');
 const heli=g.spawn(0,{x:1800,y:1600},'scout');
 g.spatial.rebuild(g.units);
 g.time=160;
 const realCanSee=g.canSee.bind(g);
 g.canSee=(owner,obj)=>owner===1&&obj.id===heli.id;
 return {g,rover,heli,realCanSee};
}

test('isolated RED jeep escapes BLUE helicopter using a real move; no squad-wide retreat',()=>{
 const {g,rover,heli,realCanSee}=skirmish();
 try{
  const tank=g.spawn(1,{x:1590,y:1630},'tank');
  const tankOrders=JSON.stringify(tank.orders);
  g.tactical.state.group=[rover.id,tank.id];
  const okay=g.tactical.evadeRoverFromHelicopter(rover);
  assert.equal(okay,true,'there is a real escape path in open terrain');
  assert.equal(rover.orders[0]?.kind,'move');
  assert.equal(rover.orders[0]?.tactical?.mode,'safe');
  assert.ok(Math.hypot(rover.orders[0].x-heli.x,rover.orders[0].y-heli.y)>
    Math.hypot(rover.x-heli.x,rover.y-heli.y),
   'escape moves away from the helicopter');
  assert.equal(g.tactical.state.battle?.withdrawals?.length,1);
  assert.equal(g.tactical.state.battle.withdrawals[0].unit,rover.id);
  assert.equal(JSON.stringify(tank.orders),tankOrders,
   'supporting tank is NEVER pulled back');
  assert.equal(g.tactical.evadeRoverFromHelicopter(rover),true,
   'reuses an active escape rather than repeating A* every frame');
 }finally{g.canSee=realCanSee;}
});

test('KI3.5 and player-controlled Humvees are not assigned autonomous air retreat',()=>{
 const {g,rover,heli,realCanSee}=skirmish();
 try{
  g.tactical.ai36Mode='off';
  assert.equal(g.tactical.evadeRoverFromHelicopter(rover),false);
  assert.equal(rover.orders.length,0);
  g.tactical.ai36Mode='coordinated';
  rover.owner=0;
  heli.owner=1;
  assert.equal(g.tactical.evadeRoverFromHelicopter(rover),false);
  assert.equal(rover.orders.length,0);
 }finally{g.canSee=realCanSee;}
});

test('real nearby rocket infantry covers the Jeep; no panic withdrawal',()=>{
 const {g,rover,heli,realCanSee}=skirmish();
 try{
  const rocket=g.spawn(1,{x:1750,y:1610},'rocket');
  g.spatial.rebuild(g.units);
  assert.ok(Math.hypot(rocket.x-heli.x,rocket.y-heli.y)<350);
  assert.equal(g.tactical.evadeRoverFromHelicopter(rover),false);
  assert.equal(rover.orders.length,0);
 }finally{g.canSee=realCanSee;}
});
