import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {SUPPLY_LOAD} from '../dist/src/reborn/supply-logistics.js';

const make=()=>new Simulation(2026,23);
const withoutAi=g=>{g.aiClock=0;g.tactical.plan=()=>{};};

test('headquarters rally never turns off a newly PRODUCED auto-hauler',()=>{
 const g=make();withoutAi(g);
 const hq=g.bases.find(b=>b.kind==='headquarters'&&b.owner===0);
 assert.ok(hq);
 hq.rally={x:hq.x+260,y:hq.y+170};
 g.credits[0]=3000;
 assert.equal(g.recruit(hq.id,'supply'),true);
 let truck=null;
 for(let i=0;i<500&&!truck;i++){
  g.step(.05);
  truck=g.units.find(u=>u.owner===0&&u.kind==='supply')??null;
 }
 assert.ok(truck,'truck leaves its HQ production queue');
 assert.ok(truck.supply?.auto,'factory rally order must not disable logistics');
 assert.ok(['seek','to-cache','loading'].includes(truck.supply.phase));
 assert.ok(truck.supply.phase!=='idle');
 assert.notEqual(truck.orders[0]?.kind,'attackMove','HQ rally is ignored by auto-supply');
});

test('an HQ-produced auto-hauler takes stock, returns and pays credits without clicks',()=>{
 const g=make();withoutAi(g);
 const hq=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 hq.rally={x:hq.x+260,y:hq.y+170};
 g.credits[0]=3000;
 assert.equal(g.recruit(hq.id,'supply'),true);
 let truck=null,loaded=false,delivered=false;
 const initialStock=g.supplyCaches.reduce((n,c)=>n+c.remaining,0);
 for(let i=0;i<4200&&g.status==='playing';i++){
  g.step(.05);
  truck??=g.units.find(u=>u.owner===0&&u.kind==='supply');
  if(truck?.supply?.cargo>0)loaded=true;
  if(g.notices.some(note=>note.startsWith('Nachschub geliefert:'))){
   delivered=true;break;
  }
 }
 assert.ok(truck,'production creates the physical truck');
 assert.ok(loaded,'real neutral stock is collected automatically');
 assert.ok(delivered,'the same truck returns and unloads without user orders');
 assert.ok(truck.supply.auto);
 assert.equal(truck.supply.cargo,0);
 assert.equal(truck.supply.phase,'seek','next automated trip starts');
 assert.ok(g.supplyCaches.reduce((n,c)=>n+c.remaining,0)<initialStock);
 assert.ok(g.stats.factions[0].earnedCredits>=SUPPLY_LOAD);
});

test('manual control remains explicit, and restarting with cargo returns to HQ',()=>{
 const g=make();withoutAi(g);
 const hq=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 const u=g.spawn(0,{x:hq.x+230,y:hq.y+150},'supply');
 assert.equal(g.command([u.id],{kind:'move',x:u.x+30,y:u.y+35}),1);
 assert.equal(u.supply.auto,false,'player order deliberately pauses automatic runs');
 u.supply.cargo=SUPPLY_LOAD;
 assert.equal(g.setSupplyAuto([u.id]),1);
 assert.equal(u.supply.auto,true);
 assert.equal(u.supply.phase,'to-hq','collected cargo must not be discarded');
});

test('WebGL HUD exposes manual/automatic phases and friendly HQ resume',()=>{
 const stage=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(stage,/MANUELL ANGEHALTEN/);
 assert.match(stage,/AUTOMATIK STARTEN/);
 assert.match(stage,/FÄHRT ZUR KOMMANDOZENTRALE/);
 assert.match(stage,/dist\(b,p\)<b\.radius\+60/);
 assert.match(stage,/this\.game\.setSupplyAuto\(ids,true\)/);
});
