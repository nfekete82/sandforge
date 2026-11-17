import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {chooseMission,newCampaign} from '../dist/src/reborn/campaign-commander.js';
import {developArmy} from '../dist/src/reborn/army-economy.js';
const make=(seed=2074)=>Simulation.campaign(seed,23,'dunes');

test('AI 3.0 issues a real infantry capture order while the HQ is being built',()=>{
 const g=make(),red=g.units.find(u=>u.owner===1&&u.kind==='infantry');
 assert.ok(red);
 const before=g.units.map(u=>u.id),money=g.credits[1];
 g.time=3;g.tactical.plan();
 assert.ok(g.bases.some(b=>b.owner===1&&b.kind==='headquarters'&&b.hp>0));
 const order=red.orders.find(o=>o.kind==='attackMove');
 assert.ok(order,'AI must act before the previous 25-second offensive gate');
 assert.ok(g.territories.some(t=>t.owner===-1&&Math.hypot(order.x-t.point.x,order.y-t.point.y)<95),
  'walkable capture ring must be reached, not a solid Bastion center');
 assert.deepEqual(g.units.map(u=>u.id),before,'no extra units are created');
 assert.ok(g.credits[1]<money,'HQ consumes normal paid credits');
 assert.equal(g.tactical.state.openingContests?.length,1);
 const previous={...red.orders[0]};
 g.time=6;g.tactical.plan();
 assert.deepEqual(red.orders[0],previous,'3-second strategy ticks must not reset paths');
});

test('additional roster members can contest a second neutral Bastion on a separate axis',()=>{
 const g=make(2026),red=g.units.find(u=>u.owner===1&&u.kind==='infantry');
 g.time=3;g.tactical.plan();
 assert.ok(red.orders.length);
 // Deterministic fixture: soldiers are in the roster before the tested decision.
 for(let i=0;i<2;i++)g.spawn(1,{x:red.x+40+i*20,y:red.y+55},'infantry');
 const roster=g.units.map(u=>u.id),money=g.credits[1];
 g.time=12;g.tactical.plan();
 const teams=g.tactical.state.openingContests??[];
 assert.ok(teams.length>=2,JSON.stringify(teams));
 assert.equal(new Set(teams.map(t=>t.sectorId)).size,2);
 assert.ok(teams.every(t=>g.territories[t.sectorId].owner===-1));
 assert.deepEqual(g.units.map(u=>u.id),roster);
 assert.equal(g.credits[1],money,'orders must never create resources');
});

test('at 3:1 the two real squad members converge on a publicly enemy-held sector',()=>{
 const g=make(2026),home=g.territories.find(t=>t.owner===1);
 assert.ok(home);
 for(const t of g.territories)if(t!==home)t.owner=0;
 const red=g.units.find(u=>u.owner===1&&u.kind==='infantry');
 for(let i=0;i<4;i++)g.spawn(1,{x:red.x+30+i*10,y:red.y+42},'infantry');
 const roster=g.units.map(u=>u.id),money=g.credits[1];
 g.time=45;g.tactical.plan();
 const active=g.tactical.state.openingContests??[];
 assert.equal(active.length,2,JSON.stringify(active));
 assert.equal(new Set(active.map(a=>a.sectorId)).size,1);
 assert.equal(g.territories[active[0].sectorId].owner,0);
 assert.deepEqual(g.units.map(u=>u.id),roster);
 assert.ok(g.credits[1]<=money);
});

test('3:1 ownership prioritizes an available enemy Bastion without fog knowledge',()=>{
 const g=make(2026),home=g.territories.find(t=>t.owner===1);
 assert.ok(home);
 for(const t of g.territories)if(t!==home)t.owner=0;
 const red=g.units.find(u=>u.owner===1),money=g.credits[1],roster=g.units.length;
 const mission=chooseMission(g,newCampaign(),red);
 assert.equal(mission?.kind,'capture');
 assert.equal(g.territories[mission.sector].owner,0);
 assert.equal(g.credits[1],money);
 assert.equal(g.units.length,roster);
});

test('modern four-sector economy purchases paid barracks before passive generator',()=>{
 const g=new Simulation(2026,23),money=g.credits[1];
 developArmy(g,g.tactical.state,g.units.filter(u=>u.owner===1&&u.hp>0),()=>0);
 assert.ok(g.bases.some(b=>b.owner===1&&b.kind==='barracks'&&b.hp>0));
 assert.ok(!g.bases.some(b=>b.owner===1&&b.kind==='generator'));
 assert.ok(g.credits[1]<money);
});

test('larger modern maps do not inherit the special four-Bastion opening',()=>{
 const g=Simulation.campaign(2026,24,'dunes');
 g.time=3;g.tactical.plan();
 assert.equal(g.tactical.state.openingContests?.length??0,0);
});
