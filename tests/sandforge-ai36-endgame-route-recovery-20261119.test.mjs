import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {newCampaign,chooseMission} from '../dist/src/reborn/campaign-commander.js';

// Map 24/26 reports: the R-01 discovers the BLUE HQ by ~106s, after
// all public Bastions are captured. Bounded strategic A* returned no route,
// making the tactical commander repeatedly clear its group until timeout.
function finishedMapWithRememberedEnemyHQ(){
 const g=new Simulation(2026,24);
 const hq=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 assert.ok(hq,'real BLUE HQ exists');
 g.territories.forEach(t=>{t.owner=1;t.capturing=-1;t.progress=0;});
 g.memories[1]=[{id:hq.id,owner:0,hp:hq.hp,
  territory:hq.territory,kind:'headquarters',x:hq.x,y:hq.y}];
 const origin=g.bases.find(b=>b.owner===1&&b.kind==='headquarters')??g.units.find(u=>u.owner===1);
 assert.ok(origin);
 const context={strategy:'unknown',force:g.units.filter(u=>u.owner===1),
  losses:[],fronts:[],intelligent:true,bastionControl:true,
  route:()=>undefined};
 return {g,hq,origin,context};
}

test('AI3.6: partial corridor keeps a real living enemy HQ as a war mission',()=>{
 const {g,hq,origin,context}=finishedMapWithRememberedEnemyHQ();
 let probes=0;
 const mission=chooseMission(g,newCampaign(),origin,{...context,
  routeFallback:p=>{probes++;assert.equal(p.x,hq.x);assert.equal(p.y,hq.y);
   return {length:2500,risk:2};}});
 assert.equal(probes,1);
 assert.equal(mission?.kind,'structure');
 assert.equal(mission?.objective,hq.id);
 assert.equal(mission?.sector,hq.territory);
 assert.equal(g.bases.find(b=>b.id===hq.id)?.hp,hq.hp,
  'no unit, structure or HP is created/damaged by the fallback');
});

test('AI3.5 unchanged: without fallback, failed full routes still give no mission',()=>{
 const {g,origin,context}=finishedMapWithRememberedEnemyHQ();
 assert.equal(chooseMission(g,newCampaign(),origin,context),undefined);
});

test('successful normal routes never invoke fallback and retain full-route priority',()=>{
 const {g,hq,origin,context}=finishedMapWithRememberedEnemyHQ();
 const mission=chooseMission(g,newCampaign(),origin,{...context,
  route:()=>({length:1200,risk:0}),
  routeFallback:()=>{throw Error('fallback must remain cold');}});
 assert.equal(mission?.objective,hq.id);
});

test('fallback cannot invent a target through fog without observed memory',()=>{
 const {g,origin,context}=finishedMapWithRememberedEnemyHQ();
 g.memories[1]=[];
 g.units=g.units.filter(u=>u.owner===1);
 let invoked=0;
 const mission=chooseMission(g,newCampaign(),origin,{...context,
  routeFallback:()=>{invoked++;return {length:100,risk:0};}});
 assert.equal(mission,undefined);
 assert.equal(invoked,0);
});

test('AI3.6 optional fallback is gated at callsite and cannot change KI3.5',()=>{
 const src=readFileSync('src/reborn/tactical-ai.ts','utf8');
 assert.match(src,/const routeFallback=this\.ai36Enabled/);
 assert.match(src,/routeFallback\}/);
 assert.match(src,/g\.world\.path\(origin,p,obstacles,5,undefined,false,false,true\)/);
});
