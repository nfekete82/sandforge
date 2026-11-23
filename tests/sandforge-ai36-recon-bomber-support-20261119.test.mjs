import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {developArmy} from '../dist/src/reborn/army-economy.js';
import {addProducer,seedCompletedGenerators} from './fixtures/reborn-production.mjs';
import {
 ai36AirDoctrineEnabled,shouldBuyReconDrone,bomberSupportQuota,
 droneFrontierPoint,observedBomberSupportTarget
} from '../dist/src/reborn/ai36-air-support.js';

test('AI3.6 paid R-01 is one active recon plane, only when ground economy is established',()=>{
 const opts={enabled:true,time:80,headquartersReady:true,barracksReady:true,
  workers:1,fighters:6,existing:0,totalPurchased:0,
  creditsAfterReserve:500,underAttack:false,room:12,needsIntel:true};
 assert.equal(shouldBuyReconDrone(opts),true);
 for(const bad of [
  {existing:1},{totalPurchased:4},{underAttack:true},
  {room:1},{workers:0},{creditsAfterReserve:50},
  {fighters:2},{barracksReady:false},{enabled:false},{needsIntel:false}
 ])assert.equal(shouldBuyReconDrone({...opts,...bad}),false,JSON.stringify(bad));
 assert.equal(UNITS.drone.cost,50);
 assert.deepEqual(UNITS.drone.producers,['headquarters']);
 assert.equal(UNITS.drone.damage,0);
});

test('first bomber is proactive close air support but never a free opening gift',()=>{
 const opts={enabled:true,airfieldReady:true,fighters:8,
  groundVehicles:3,income:70,time:170,underAttack:false,
  enemyAir:0,contestedBastions:true,finishing:false};
 assert.equal(bomberSupportQuota(opts),1);
 for(const bad of [
  {enabled:false},{airfieldReady:false},{fighters:4},
  {groundVehicles:1},{income:35},{time:70},{underAttack:true},
  {enemyAir:2},{contestedBastions:false},{finishing:true}
 ])assert.equal(bomberSupportQuota({...opts,...bad}),0,JSON.stringify(bad));
});

test('scouting forward always stays inside map and normal fog applies',()=>{
 assert.deepEqual(droneFrontierPoint({x:100,y:100},{x:1000,y:100},4000,400),
  {x:600,y:100});
 const edge=droneFrontierPoint({x:3900,y:3900},{x:4100,y:4200},4000,300);
 assert.ok(edge.x>=50&&edge.x<=3950&&edge.y>=50&&edge.y<=3950);
 const visible=[
  {id:1,kind:'infantry',hp:100,x:1250,y:1220},
  {id:2,kind:'tank',hp:600,x:1360,y:1190},
  {id:3,kind:'bomber',hp:700,x:1320,y:1200}
 ];
 assert.equal(observedBomberSupportTarget(visible.slice(0,2),{x:1200,y:1200})?.id,2,
  'closely contested tank takes priority over one isolated rifleman');
 assert.equal(observedBomberSupportTarget([], {x:1200,y:1200}),undefined);
 assert.equal(observedBomberSupportTarget(visible,{x:3500,y:3500}),undefined);
});

function setup(seed=260119,mapVersion=24){
 const g=new Simulation(seed,mapVersion);
 g.aiClock=1e8;
 g.tactical.plan=()=>{};
 g.time=170;g.credits[1]=6500;
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 assert.ok(home);
 addProducer(g,'barracks',1);
 addProducer(g,'factory',1);
 const airfield=addProducer(g,'airfield',1);
 seedCompletedGenerators(g);
 const hx=home.x,hy=home.y;
 for(let i=0;i<6;i++)g.spawn(1,{x:hx+40+i*10,y:hy+80},'infantry');
 for(let i=0;i<2;i++)g.spawn(1,{x:hx+100+i*13,y:hy+90},'tank');
 return {g,home,airfield};
}
const pulse=g=>developArmy(g,g.tactical.state,
 g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier),()=>0);

test('real AI3.6 purchases R-01 from HQ and bomber from airfield with real credits',()=>{
 const {g,home,airfield}=setup();
 assert.equal(ai36AirDoctrineEnabled(g),true);
 const original=g.credits[1];
 pulse(g);
 assert.ok(home.queueTypes.includes('drone'),'HQ paid R-01 reconnaissance queue');
 assert.ok(airfield.queueTypes.includes('bomber'),
  'airfield paid a bomber without requiring observed tanks');
 assert.equal(home.queueCosts[home.queueTypes.indexOf('drone')],UNITS.drone.cost);
 assert.equal(airfield.queueCosts[airfield.queueTypes.indexOf('bomber')],UNITS.bomber.cost);
 assert.ok(original-g.credits[1]>=UNITS.drone.cost+UNITS.bomber.cost);
 assert.equal(g.tactical.state.economy.produced.drone,1);
 const queued=home.queueTypes.filter(t=>t==='drone').length;
 pulse(g);
 assert.equal(home.queueTypes.filter(t=>t==='drone').length,queued,
  'queued drone already counts and is never spammed');
});

test('older maps and opt-out AI3.5 never purchase R-01 or proactive bombers',()=>{
 const {g,home,airfield}=setup(260119,4);
 assert.equal(ai36AirDoctrineEnabled(g),false);
 pulse(g);
 assert.equal(home.queueTypes.includes('drone'),false);
 assert.equal(airfield.queueTypes.includes('bomber'),false);
});

test('real tactical bomber supports only presently observed ground enemies and keeps ongoing orders',()=>{
 const g=new Simulation(260120,24);g.aiClock=1e8;g.tactical.plan=()=>{};
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 assert.ok(home);
 const dx=home.x<g.world.size/2?1:-1;
 const dy=home.y<g.world.size/2?1:-1;
 const screen=g.spawn(1,{x:home.x+dx*280,y:home.y+dy*280},'tank');
 const bomber=g.spawn(1,{x:home.x+dx*230,y:home.y+dy*260},'bomber');
 const target=g.spawn(0,{x:home.x+dx*550,y:home.y+dy*360},'heavy');
 const hidden=g.spawn(0,{x:home.x+dx*510,y:home.y+dy*520},'tank');
 const oldCanSee=g.canSee.bind(g);
 g.canSee=(owner,entity)=>owner===1&&entity.id===target.id;
 try{
  g.tactical.state.group=[screen.id];
  g.tactical.supportBombers([screen,bomber],home);
  assert.equal(bomber.orders.length,2);
  assert.equal(bomber.orders[0].kind,'move');
  assert.equal(bomber.orders[1].kind,'attack');
  assert.equal(bomber.orders[1].target,target.id);
  assert.notEqual(bomber.orders[1].target,hidden.id,'no hidden-target wallhack');
  const issued=bomber.orders[1];
  g.tactical.supportBombers([screen,bomber],home);
  assert.equal(bomber.orders[1],issued,'sortie is stable across AI pulses');
  g.stop([bomber.id]);g.canSee=()=>false;
  g.tactical.supportBombers([screen,bomber],home);
  assert.equal(bomber.orders.length,0,'fogged targets cannot be reacquired');
 }finally{g.canSee=oldCanSee;}
});

test('recon drone is included in campaign frontier scouting, not as a combatant',()=>{
 const g=new Simulation(260121,24);g.aiClock=1e8;g.tactical.plan=()=>{};
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 const drone=g.spawn(1,{x:home.x+45,y:home.y+45},'drone');
 g.tactical.campaignRecon([drone],home);
 assert.ok(drone.orders.length>0,'paid R-01 gets a real movement order');
 assert.equal(drone.orders[0].kind,'move');
 const src=readFileSync('src/reborn/tactical-ai.ts','utf8');
 assert.match(src,/this\.ai36Enabled&&u\.kind==='drone'/);
 assert.match(src,/this\.supportBombers\(army\.filter\(u=>u\.kind!=='bomber'\|\|!defense\.has\(u\.id\)\),home\)/,
  'local-defense bombers must not be pulled into unrelated air support');
 assert.doesNotMatch(src,/g\.memories\[0\].*supportBombers/);
});
