import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {RULES} from '../dist/src/reborn/config.js';
import {capturePresenceRadius} from '../dist/src/reborn/territory-warfare.js';

const step=(g,seconds)=>{for(let t=0;t<Math.round(seconds/.05);t++)g.step(.05);};
function setup(owner,version=24){
 const g=new Simulation(20261118,version);
 g.aiClock=-1000000;
 g.units=[];
 const t=g.territories.find(s=>s.owner===-1&&
  !g.bases.some(b=>b.hp>0&&b.kind==='headquarters'&&b.territory===s.id));
 assert.ok(t,'unoccupied neutral bastion required');
 return {g,t,unit:g.spawn(owner,{x:t.point.x+117,y:t.point.y},'infantry')};
}
test('3D maps grant both factions physical capture within 125 units of a visible Bastion',()=>{
 for(const owner of [0,1]){
  const {g,t,unit}=setup(owner);
  assert.equal(capturePresenceRadius(g.world.mapVersion),125);
  assert.ok(Math.hypot(unit.x-t.point.x,unit.y-t.point.y)>RULES.captureRadius);
  assert.equal(g.captureReadiness(t,owner),'capturing',
   'standing next to the visible 3D tower should not require RMB clicks');
  step(g,1);
  assert.equal(t.capturing,owner);
  assert.ok(t.progress>0,'capture starts automatically on presence alone');
  step(g,8);
  assert.equal(t.owner,owner,'Bastion ownership changes without an extra command');
 }
});
test('a contested ring never captures; enemy HQ still blocks; R-01 drones remain excluded',()=>{
 const {g,t,unit}=setup(0);
 const enemy=g.spawn(1,{x:t.point.x-119,y:t.point.y},'infantry');
 assert.equal(g.captureReadiness(t,0),'contested');
 step(g,9);
 assert.equal(t.owner,-1,'presence of an enemy soldier blocks capture');
 enemy.hp=0;
 g.spawn(0,{x:t.point.x+70,y:t.point.y},'drone');
 step(g,8.3);
 assert.equal(t.owner,0,'drone presence does not prevent infantry capture');
 const hq=g.bases.find(b=>b.owner===1&&b.kind==='headquarters'&&b.hp>0);
 assert.ok(hq);const home=g.territories[hq.territory];
 Object.assign(unit,{x:home.point.x+112,y:home.point.y});
 g.spatial.rebuild(g.units);
 assert.equal(g.captureReadiness(home,0),'enemy-hq');
});
test('an R-01 alone cannot capture even when physically beside the 3D tower',()=>{
 const {g,t,unit}=setup(0);unit.hp=0;
 g.spawn(0,{x:t.point.x+90,y:t.point.y},'drone');
 assert.equal(g.captureReadiness(t,0),'no-unit');
 step(g,9);assert.equal(t.owner,-1);
});
test('historical maps keep the original 95-unit capture ring',()=>{
 for(const version of [1,11,19,22])assert.equal(capturePresenceRadius(version),RULES.captureRadius);
 assert.equal(capturePresenceRadius(23),125);
 assert.equal(capturePresenceRadius(26),125);
 const {g,t}=setup(0,19);
 assert.equal(g.captureReadiness(t,0),'out-of-range');
});
test('WebGL right clicks use the same capture zone as authoritative sim',async()=>{
 const {readFileSync}=await import('node:fs');
 const s=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(s,/capturePresenceRadius\(this\.game\.world\.mapVersion\)\+34/);
});
