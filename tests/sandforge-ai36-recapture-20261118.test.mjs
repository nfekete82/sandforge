import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {recaptureDetachmentSize,recaptureObjectiveScore,recaptureThreatPermits} from '../dist/src/reborn/ai36-recapture-doctrine.js';
import {parseOptions} from '../scripts/benchmark-reborn-ai.mjs';

const ready=(overrides={})=>({
 mapVersion:24,time:130,ownSectors:2,enemySectors:4,
 eligible:8,homeUnderAttack:false,recentlyLost:true,...overrides
});
test('KI3.6 creates only affordable paid 2-/3-unit missions and retains HQ plus army screen',()=>{
 assert.equal(recaptureDetachmentSize(ready()),2);
 assert.equal(recaptureDetachmentSize(ready({eligible:6})),0);
 assert.equal(recaptureDetachmentSize(ready({homeUnderAttack:true})),0);
 assert.equal(recaptureDetachmentSize(ready({mapVersion:26,eligible:10})),3);
 assert.equal(recaptureDetachmentSize(ready({mapVersion:26,eligible:9})),0);
 assert.equal(recaptureDetachmentSize(ready({mapVersion:25,eligible:30})),0);
 assert.equal(recaptureDetachmentSize(ready({mapVersion:23,eligible:30})),0);
 assert.equal(recaptureDetachmentSize(ready({time:70})),0);
 assert.equal(recaptureDetachmentSize(ready({enemySectors:1})),0);
 assert.equal(recaptureDetachmentSize(ready({ownSectors:5,enemySectors:2,recentlyLost:false})),0);
 assert.equal(recaptureDetachmentSize(ready({ownSectors:5,enemySectors:2,recentlyLost:true})),2);
});
test('recently lost Bastions outrank equivalent fronts but observed threats remain decisive',()=>{
 const basic={routeLength:900,routeRisk:1,income:25,recentLoss:false,
  visibleDefenders:0,alreadyAssigned:false};
 assert.ok(recaptureObjectiveScore({...basic,recentLoss:true})<recaptureObjectiveScore(basic));
 assert.ok(recaptureObjectiveScore({...basic,routeRisk:10})>recaptureObjectiveScore(basic));
 assert.ok(recaptureObjectiveScore({...basic,visibleDefenders:2})>recaptureObjectiveScore(basic));
 assert.ok(recaptureObjectiveScore({...basic,income:45})<recaptureObjectiveScore(basic));
 assert.equal(recaptureThreatPermits(100,50,false),true);
 assert.equal(recaptureThreatPermits(100,90,false),false);
 assert.equal(recaptureThreatPermits(100,0,true),false);
 assert.equal(recaptureThreatPermits(0,0,false),false);
});
function scenario(){
 const g=new Simulation(2026,24);
 g.aiClock=-1e9;g.time=155;
 g.world.blocked.fill(0);g.world.opaque.fill(0);
 g.world.components.fill(0);g.world.cliffIds.fill(-1);
 g.units=g.units.filter(u=>u.owner===1);
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters'&&b.hp>0);
 assert.ok(home,'red HQ exists');
 const red=g.territories.find(t=>t.owner===1&&t.id===home.territory);
 assert.ok(red,'red home Bastion owned');
 const blueHQ=g.bases.find(b=>b.owner===0&&b.kind==='headquarters'&&b.hp>0);
 const site=red.neighbors.map(id=>g.territories[id]).find(t=>t.owner!==1&&t.id!==blueHQ?.territory);
 assert.ok(site,'an exposed neutral Bastion exists next to the RED sector');
 site.owner=0;
 for(const t of g.territories.filter(t=>t.owner===-1&&t.id!==site.id).slice(0,3))t.owner=0;
 const fighters=Array.from({length:10},(_,i)=>g.spawn(1,{
   x:home.x+140+i%5*24,y:home.y+140+Math.floor(i/5)*25
 },i<8?'infantry':'heavy'));
 assert.equal(fighters.length,10);
 g.tactical.ai33Mode='adaptive';g.tactical.ai35Mode='control';g.tactical.ai36Mode='coordinated';
 return {g,home,site,fighters};
}
test('real tactical 3.6 squad launches simultaneous paid attackMove orders into capture ring',()=>{
 const {g,home,site,fighters}=scenario();
 const credits=[...g.credits],units=g.units.map(u=>u.id);
 g.tactical.state.phase='gather';
 const selected=g.tactical.coordinatedRecapture(fighters,home);
 assert.equal(selected.size,2,'two real soldiers detached to blue Bastion');
 assert.equal(g.tactical.recaptureMission?.sector,site.id);
 for(const id of selected){
  const u=g.units.find(u=>u.id===id);
  assert.equal(u.orders[0]?.kind,'attackMove');
  assert.ok(Math.hypot(u.orders[0].x-site.point.x,u.orders[0].y-site.point.y)<=125,
   'arrival inside modern Bastion capture radius');
  assert.equal(u.orders[0].guardOnArrival,true);
 }
 const ordered=selected.size;
 g.time+=3;
 assert.equal(g.tactical.coordinatedRecapture(fighters,home).size,ordered);
 assert.deepEqual(g.units.map(u=>u.id),units,'no free soldiers');
 assert.deepEqual(g.credits,credits,'no credits or free buildings');
 const homes=fighters.filter(u=>!selected.has(u.id));
 assert.ok(homes.length>=8,'HQ and main army remain manned');
});
test('recapture squad holds gained Bastion for 15 simulated seconds instead of immediately leaving',()=>{
 const {g,home,site,fighters}=scenario();
 const assigned=g.tactical.coordinatedRecapture(fighters,home);
 assert.equal(assigned.size,2);
 site.owner=1;g.time+=4;
 for(const id of assigned){const u=g.units.find(v=>v.id===id);u.x=site.point.x+102;u.y=site.point.y;}
 assert.equal(g.tactical.coordinatedRecapture(fighters,home).size,2);
 for(const id of assigned){const u=g.units.find(v=>v.id===id);
  assert.equal(u.hold,true);assert.equal(u.guardArea,true);
  assert.equal(u.orders.length,0);
 }
 g.time+=16;assert.equal(g.tactical.coordinatedRecapture(fighters,home).size,0);
 assert.equal(g.tactical.recaptureMission,null);
 for(const id of assigned){
  const u=g.units.find(v=>v.id===id);
  assert.equal(u.hold,false,'temporary garrison returns to the mobile army');
  assert.equal(u.guardArea,false);
 }
});
test('same-binary A/B opt-out retains KI3.5 with identical start-state and no new save fields',()=>{
 const {g,home,site,fighters}=scenario();
 const starts=g.units.map(u=>u.id),credits=[...g.credits];
 g.tactical.ai36Mode='off';
 assert.equal(g.tactical.coordinatedRecapture(fighters,home).size,0);
 assert.deepEqual(g.units.map(u=>u.id),starts);
 assert.deepEqual(g.credits,credits);
 const save=g.save();
 assert.equal(JSON.stringify(save).includes('ai36Mode'),false);
 assert.equal(JSON.stringify(save).includes('recaptureMission'),false);
 assert.equal(parseOptions(['--ai36','off']).ai36,'off');
 assert.equal(parseOptions(['--ai36','coordinated']).ai36,'coordinated');
 assert.throws(()=>parseOptions(['--ai36','cheat']),/Invalid benchmark options/);
 const menu=readFileSync('scripts/webgl-title-menu.js','utf8');
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 assert.match(menu,/params\.set\('ai36',query\.get\('ai36'\)\)/);
 assert.match(preview,/game\.tactical\.ai36Mode=query\.get\('ai36'\)/);
 assert.equal(site.owner,0);
});
test('real observed home invasion cancels the detachment and drones cannot fake the threat',()=>{
 const {g,home,fighters}=scenario();
 g.spawn(0,{x:home.x+170,y:home.y},'infantry');
 g.updateVision();
 assert.equal(g.tactical.coordinatedRecapture(fighters,home).size,0);
});
