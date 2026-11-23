import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {observedInfantryFlamerQuota,produceCombinedArmy} from '../dist/src/reborn/director-production.js';

const input={factoryReady:true,observedInfantry:4,observedArmor:0,
 observedAir:0,ownTanks:1,fighters:7,income:45,time:130,
 underAttack:false,finishing:false};

test('sighted infantry allows exactly ONE paid flamer after a normal tank',()=>{
 assert.equal(observedInfantryFlamerQuota(input),1);
 assert.equal(observedInfantryFlamerQuota({...input,observedInfantry:8}),1,
  'massed infantry cannot trigger uncontrolled flame tank production');
});

test('no hidden-sighting or weak early-economy flame purchases',()=>{
 for(const patch of [
  {observedInfantry:0},{observedInfantry:2},{factoryReady:false},
  {ownTanks:0},{fighters:5},{income:24},{time:84},
  {observedArmor:1},{observedAir:1},{underAttack:true},{finishing:true}
 ]){
  assert.equal(observedInfantryFlamerQuota({...input,...patch}),0,
   'no flame quota when safety precondition is missing: '+JSON.stringify(patch));
 }
});

// Use actual Simulation.recruit, legitimate credits and queue accounting;
// the observed enemies are passed in the very same c.seen interface that
// tactical AI fills with units it can physically see.
function combatFixture(enemyKinds=['infantry','infantry','infantry','infantry']){
 const g=new Simulation(20261123,24);
 g.time=130;g.credits[1]=5000;
 const base={id:2000,owner:1,kind:'factory',hp:1100,buildRemaining:0,
  x:1600,y:1600,radius:70,territory:0,queue:[],queueTypes:[],
  queueCosts:[],production:0,cooldown:0,rally:null};
 const hq={...base,id:2001,kind:'headquarters',radius:83,hp:1200,x:1700};
 g.bases.push(base,hq);
 const army=[];
 for(const kind of ['tank','rover','infantry','infantry','infantry','infantry','engineer']){
  const u=g.spawn(1,{x:1850+army.length*23,y:1800+army.length*17},kind);
  army.push(u);
 }
 const seen=enemyKinds.map((kind,i)=>g.spawn(0,{x:2240+i*45,y:2140},kind));
 const c={own:[base],army,seen,income:45,underAttack:false,
  knownTurrets:0,knownEnemyHQ:false,reserve:0,siegeReserve:0,
  maxArmy:48,scores:Object.fromEntries(Object.keys(UNITS).map(k=>[k,k==='flamer'?0:80])),
  defenseNeedsWorker:false,finishing:false};
 const s=g.tactical.state;
 s.economy??={goal:null,since:g.time,attemptAt:-9,produced:{},built:{}};
 return {g,s,c,base};
}

test('real factory spends credits once, counts its queued flame tank and never buys a second',()=>{
 const {g,s,c,base}=combatFixture();
 const credits=g.credits[1];
 produceCombinedArmy(g,s,c);
 assert.ok(base.queueTypes.includes('flamer'),
  'observed infantry creates a REAL paid flamer queue, not a virtual army unit');
 assert.equal(g.credits[1],credits-UNITS.flamer.cost);
 assert.equal(base.queueCosts[0],UNITS.flamer.cost);
 produceCombinedArmy(g,s,c);
 assert.equal(base.queueTypes.filter(k=>k==='flamer').length,1,
  'queued flamer fulfills the quota and must never be bought twice');
 assert.ok(g.credits[1]>=0);
});

test('real factory prioritizes conventional armor over flame when tanks or air are observed',()=>{
 for(const foe of ['tank','scout']){
  const {g,s,c,base}=combatFixture(['infantry','infantry','infantry','infantry',foe]);
  produceCombinedArmy(g,s,c);
  assert.ok(!base.queueTypes.includes('flamer'),'flamer is not counter to '+foe);
 }
});
