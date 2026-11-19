import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {bomberCloseAirSupportAllowed} from '../dist/src/reborn/ai36-air-support.js';

const at=(id,kind,x,y,hp=100)=>({id,kind,x,y,hp});
const tank=at(1,'tank',1200,1300);
const nearby=[tank,at(2,'tank',1250,1310),at(3,'heavy',1220,1370),
 at(4,'infantry',1190,1390),at(5,'infantry',1300,1300)];
const armorEscort=[at(20,'tank',1100,1280),at(21,'tank',1130,1320)];
const infantryEscort=[at(22,'infantry',1120,1290),
 at(23,'heavy',1130,1260),at(24,'rocket',1140,1240),
 at(25,'infantry',1090,1330)];

test('a truly isolated ground target permits an independent short bomber strike',()=>{
 assert.equal(bomberCloseAirSupportAllowed(tank,[tank],[]),true);
 assert.equal(bomberCloseAirSupportAllowed(at(7,'rover',1200,1300),
  [at(7,'rover',1200,1300)],[]),true);
});

test('the screenshot case: two tanks plus several infantry NEVER trigger a solo bomber dive',()=>{
 assert.equal(bomberCloseAirSupportAllowed(tank,nearby,[]),false);
 assert.equal(bomberCloseAirSupportAllowed(tank,nearby,
  [at(30,'tank',300,300),at(31,'tank',350,350)]),false,
 'a purchased tank screen across the map is not close air support');
 assert.equal(bomberCloseAirSupportAllowed(tank,nearby,
  [at(32,'infantry',1160,1280)]),false,
 'one rifleman is not a credible ground attack');
});

test('bomber supports an ACTUAL nearby assault with two tanks or a real mixed squad',()=>{
 assert.equal(bomberCloseAirSupportAllowed(tank,nearby,armorEscort),true);
 assert.equal(bomberCloseAirSupportAllowed(tank,nearby,infantryEscort),true);
});

test('living rocket infantry, turrets and defended HQs block speculative solo dives',()=>{
 const rocket=at(6,'rocket',1240,1280);
 const turret=at(7,'turret',1250,1280,650);
 const hq=at(8,'headquarters',1220,1330,1200);
 assert.equal(bomberCloseAirSupportAllowed(tank,[tank,rocket],[]),false);
 assert.equal(bomberCloseAirSupportAllowed(tank,[tank,turret],[]),false);
 assert.equal(bomberCloseAirSupportAllowed(hq,[hq],[]),false);
 assert.equal(bomberCloseAirSupportAllowed(tank,[tank,rocket],armorEscort),true);
 assert.equal(bomberCloseAirSupportAllowed(tank,[tank,rocket],
  [at(30,'tank',1100,1280)]),false);
});

test('only actually observed targets qualify, not forgotten/fogged targets',()=>{
 assert.equal(bomberCloseAirSupportAllowed(tank,nearby.filter(v=>v.id!==tank.id),armorEscort),false);
 assert.equal(bomberCloseAirSupportAllowed({...tank,hp:0},nearby,armorEscort),false);
});

function arena(seed=261119){
 const g=new Simulation(seed,24);
 g.aiClock=1e9;g.tactical.plan=()=>{};
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 assert.ok(home);
 const dx=home.x<g.world.size/2?1:-1,dy=home.y<g.world.size/2?1:-1;
 const x=home.x+dx*450,y=home.y+dy*450;
 const bomber=g.spawn(1,{x:x-dx*360,y:y-dy*360},'bomber');
 const hostile=[g.spawn(0,{x,y},'tank'),
  g.spawn(0,{x:x+dx*65,y:y+dy*45},'tank'),
  g.spawn(0,{x:x-dx*45,y:y+dy*70},'heavy')];
 const oldCanSee=g.canSee.bind(g);
 g.canSee=(owner,p)=>owner===1&&hostile.some(v=>v.id===p.id);
 return {g,home,bomber,hostile,oldCanSee,x,y,dx,dy};
}

test('real KI3.6 support planner waits for a ground assault, then queues actual close air support',()=>{
 const a=arena();
 try{
  a.g.tactical.supportBombers([a.bomber],a.home);
  assert.equal(a.bomber.orders.length,0,'no unescorted sortie');
  const escort=[a.g.spawn(1,{x:a.x-a.dx*100,y:a.y-a.dy*90},'tank'),
   a.g.spawn(1,{x:a.x-a.dx*135,y:a.y-a.dy*100},'tank')];
  for(const u of escort)u.orders=[{kind:'attackMove',x:a.x,y:a.y}];
  a.g.tactical.state.group=escort.map(u=>u.id);
  a.g.tactical.supportBombers([a.bomber,...escort],a.home);
  assert.equal(a.bomber.orders.length,2);
  assert.equal(a.bomber.orders[0].kind,'move');
  assert.equal(a.bomber.orders[1].kind,'attack');
  assert.ok(a.hostile.some(v=>v.id===a.bomber.orders[1].target));
  // If both screening tanks die, a still-pending attack is withdrawn.
  for(const u of escort)u.hp=0;
  a.g.tactical.supportBombers([a.bomber],a.home);
  assert.equal(a.bomber.orders[0]?.kind,'move');
  assert.equal(a.bomber.orders.some(o=>o.kind==='attack'),false,
   'retreat instead of a doomed attack after ground support collapses');
 }finally{a.g.canSee=a.oldCanSee;}
});

test('AI3.5 and player bombers are never gated by this AI3.6 policy',()=>{
 const a=arena(261120);
 try{
  a.g.tactical.ai36Mode='off';
  assert.equal(a.g.tactical.bomberStrikeSafe(a.hostile[0]),true);
 }finally{a.g.canSee=a.oldCanSee;}
});

test('transport MG strengthened by one step, independent from the six light rockets',()=>{
 assert.equal(UNITS.scout.damage,24);
 assert.equal(UNITS.scout.range,225);
 assert.equal(UNITS.scout.cooldown,.6);
 assert.equal(UNITS.scout.speed,280);
});

test('transport MG auto-fires at exposed infantry in range even on a move order',()=>{
 const g=new Simulation(261121,24);g.aiClock=1e9;g.tactical.plan=()=>{};
 const base=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 assert.ok(base);
 const heli=g.spawn(0,{x:base.x+300,y:base.y+300},'scout');
 const soldier=g.spawn(1,{x:heli.x+60,y:heli.y+25},'infantry');
 const move={kind:'move',x:heli.x+300,y:heli.y+60};
 heli.orders=[move];heli.rocketAmmo=3;heli.rocketCooldown=6;
 g.canSee=()=>true;
 g.spatial.rebuild(g.units);
 const originalHp=soldier.hp;
 g.helicopterMachinegun(heli);
 assert.ok(heli.cooldown>0);
 assert.equal(g.shots.at(-1)?.weapon,'machinegun');
 assert.equal(heli.orders[0],move,'a transport never abandons the troop mission');
 assert.equal(heli.rocketAmmo,3,'the MG does not consume a rocket');
 for(let i=0;i<12&&soldier.hp>0;i++){
  heli.cooldown=0;g.time+=.6;
  g.helicopterMachinegun(heli);
 }
 assert.ok(soldier.hp<originalHp,'the upgraded gun can actually hurt a soldier');
});

test('no automatic MG firing during landing or from passive hold',()=>{
 const g=new Simulation(261122,24);g.aiClock=1e9;g.tactical.plan=()=>{};
 const p=g.bases.find(b=>b.owner===0);
 const heli=g.spawn(0,{x:p.x+90,y:p.y+90},'scout');
 g.spawn(1,{x:heli.x+40,y:heli.y+30},'infantry');
 g.canSee=()=>true;g.spatial.rebuild(g.units);
 heli.transport={phase:'landing'};
 g.helicopterMachinegun(heli);
 assert.equal(g.shots.length,0);
 heli.transport=undefined;heli.hold=true;heli.guardArea=false;
 g.helicopterMachinegun(heli);
 assert.equal(g.shots.length,0);
});
