import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {hqLastStandDecision} from '../dist/src/reborn/ai-hq-last-stand.js';

test('seven observed tanks trigger HQ last stand even outside old 560 radius',()=>{
 const observed=Array.from({length:7},(_,i)=>({
  id:100+i,kind:'tank',distance:650+i*12
 }));
 const result=hqLastStandDecision({mapVersion:24,hqDamaged:false,observed});
 assert.equal(result.emergency,true);
 assert.equal(result.observedCount,7);
 assert.ok(observed.some(t=>t.id===result.focus));
 assert.equal(hqLastStandDecision({mapVersion:11,hqDamaged:false,observed}).emergency,false);
});

test('HQ damage triggers defense without inferring invisible attacker IDs',()=>{
 const result=hqLastStandDecision({mapVersion:24,hqDamaged:true,observed:[]});
 assert.equal(result.emergency,true);
 assert.equal(result.focus,null);
 assert.equal(result.observedCount,0);
 assert.equal(hqLastStandDecision({mapVersion:24,hqDamaged:false,observed:[]}).emergency,false);
 assert.equal(hqLastStandDecision({mapVersion:24,hqDamaged:false,
  observed:[{id:10,kind:'infantry',distance:1050}]}).emergency,false);
});

test('all paid combat forces abandon remote attack when seven visible blue tanks rush HQ',()=>{
 const g=new Simulation(20261122,24);
 g.time=220;g.credits=[0,0];
 g.world.blocked.fill(0);g.world.opaque.fill(0);g.world.components.fill(0);
 const hq=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 assert.ok(hq);
 const clamp=(n)=>Math.min(g.world.size-110,Math.max(110,n));
 const pos={x:clamp(hq.x+240),y:clamp(hq.y+145)};
 const attackers=Array.from({length:7},(_,i)=>g.spawn(0,{
  x:clamp(pos.x+(i%3)*17),y:clamp(pos.y+Math.floor(i/3)*19)
 },'tank'));
 // Actual paid defending column was on a distant offensive.
 const defenders=['tank','tank','tank','heavy','rocket','artillery','infantry','rover']
  .map((kind,i)=>g.spawn(1,{x:clamp(hq.x-520-i*8),
   y:clamp(hq.y-430+i*14)},kind));
 for(const u of defenders)u.orders=[{kind:'attackMove',x:g.world.size*.5,y:g.world.size*.5}];
 g.updateVision();
 assert.ok(attackers.some(u=>g.canSee(1,u)),'at least one tank must be truly visible');
 const beforeUnits=g.units.length,initialCredits=g.credits[1];
 const red=g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier);
 const alerted=g.tactical.defendHeadquartersWithAll(red,hq);
 assert.equal(alerted,true);
 assert.equal(g.tactical.state.phase,'defend');
 assert.equal(g.units.length,beforeUnits,'last stand cannot spawn units');
 assert.equal(g.credits[1],initialCredits,'last stand cannot generate credits');
 for(const u of defenders){
  assert.equal(u.orders[0]?.tactical?.mode,'defend',
   u.kind+' remained on a distant offensive instead of recalling to the HQ');
  assert.ok(attackers.some(v=>v.id===u.orders[0]?.target),
   'defense must target a genuinely visible tank, not an unseen roster');
 }
});

test('actual HQ damage without visual intelligence recalls troops, not invisible targets',()=>{
 const g=new Simulation(8888,24);
 g.time=230;g.credits=[0,0];
 g.world.blocked.fill(0);g.world.opaque.fill(0);g.world.components.fill(0);
 const hq=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 assert.ok(hq);
 const red=g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier);
 assert.equal(g.tactical.defendHeadquartersWithAll(red,hq),false);
 hq.hp-=31;g.time+=3;
 assert.equal(g.tactical.defendHeadquartersWithAll(red,hq),true);
 assert.equal(g.tactical.state.phase,'defend');
 assert.equal(g.tactical.state.objective,null);
 assert.equal(g.tactical.state.group.every(id=>red.some(u=>u.id===id)),true);
});

test('sustained contact does not repeatedly reset current defense phase',()=>{
 const g=new Simulation(8887,24);
 g.time=230;
 const hq=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 assert.ok(hq);
 const enemy=g.spawn(0,{x:hq.x+180,y:hq.y+100},'tank');
 g.updateVision();
 assert.ok(g.canSee(1,enemy));
 const red=g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier);
 g.tactical.defendHeadquartersWithAll(red,hq);
 const groupId=g.tactical.state.groupId;
 g.time+=2;
 g.tactical.defendHeadquartersWithAll(red,hq);
 assert.equal(g.tactical.state.groupId,groupId,
  'repeated AI pulses must not reshuffle the defending formation');
});
