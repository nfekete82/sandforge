import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {newBattle,assessBattle,fightingPower} from '../dist/src/reborn/battle-response.js';
import {rankBastionDefenses} from '../dist/src/reborn/bastion-defense.js';
import {selectObservedCounterTarget} from '../dist/src/reborn/ai-counter-doctrine.js';
import {UNITS} from '../dist/src/reborn/catalog.js';

const scene=()=>{
 const g=new Simulation(20261118,24);
 g.units=[];
 g.world.blocked.fill(0);
 g.world.opaque.fill(0);
 g.tactical.state.battle=newBattle();
 const hq=g.bases.find(b=>b.kind==='headquarters'&&b.owner===1&&b.hp>0);
 assert.ok(hq,'red headquarters exists');
 const rocket=g.spawn(1,{x:hq.x+80,y:hq.y+100},'rocket');
 const drone=g.spawn(0,{x:rocket.x+120,y:rocket.y},'drone');
 g.spatial.rebuild(g.units);
 g.updateVision();
 assert.equal(g.canSee(1,drone),true,'red must visibly observe the aircraft');
 return {g,hq,rocket,drone};
};

test('drone is zero strategic combat power and never counted as enemy force',()=>{
 const {g,rocket,drone}=scene();
 assert.equal(fightingPower([drone]),0);
 assert.equal(assessBattle([rocket],[drone],[],g.time,true).enemy,0);
 assert.equal(selectObservedCounterTarget('rocket',rocket,[drone],800),undefined);
 assert.equal(selectObservedCounterTarget('bomber',rocket,[drone],800),undefined);
});

test('a visible recon drone alone never causes local base defense, withdrawals or danger zones',()=>{
 const {g,rocket,drone}=scene();
 assert.ok(g.tactical.zones().every(z=>z.x!==drone.x||z.y!==drone.y));
 assert.equal(g.tactical.acquire?.(rocket),undefined);
 g.time=20;
 g.tactical.plan();
 const defense=g.tactical.state.battle?.squads.filter(s=>s.role==='defense')??[];
 assert.deepEqual(defense,[],'the harmless drone must not trigger an emergency defense');
 assert.equal(g.tactical.state.battle?.withdrawals.length??0,0);
 assert.equal(g.tactical.state.adaptive?.counts.air??0,0,'recon is not a real air strategy');
});

test('a genuine visible soldier still triggers anti-invasion defense',()=>{
 const {g,hq,rocket}=scene();
 const intruder=g.spawn(0,{x:hq.x+95,y:hq.y+100},'infantry');
 g.spatial.rebuild(g.units);g.updateVision();
 assert.equal(g.canSee(1,intruder),true);
 const visible=g.units.filter(u=>u.owner===0&&g.canSee(1,u)&&u.kind!=='drone');
 assert.ok(visible.includes(intruder));
 const assigned=g.tactical.localDefense([rocket],[],[intruder],hq);
 assert.ok(assigned.has(rocket.id),'real infantry remains a real strategic intruder');
});

test('rocket AA fires at an in-range passing drone without changing its mission',()=>{
 const {g,rocket,drone}=scene();
 assert.equal(UNITS.drone.damage,0);
 const order={kind:'attackMove',x:rocket.x+400,y:rocket.y+100};
 rocket.orders=[order];
 g.shootPassingDrone(rocket);
 assert.equal(g.missiles.filter(m=>m.target===drone.id).length,1);
 assert.equal(rocket.orders[0],order,'no mission interruption or retreat');
 assert.equal(rocket.combatTarget??null,null,'recon shot does not create a target lock');
 assert.equal(rocket.pursuitOrigin??null,null,'recon shot does not create pursuit origin');
});

test('live enemy troops take fire priority over a passing drone',()=>{
 const {g,rocket,drone}=scene();
 const soldier=g.spawn(0,{x:rocket.x+85,y:rocket.y},'infantry');
 g.spatial.rebuild(g.units);g.updateVision();
 g.shootPassingDrone(rocket);
 assert.equal(g.missiles.length,0,'no rocket wasted on harmless recon during real combat');
 const acquired=g.acquire(rocket);
 assert.equal(acquired?.id,soldier.id);
 assert.notEqual(acquired?.id,drone.id);
});

test('recon drones do not justify defensive tower construction',()=>{
 const {g,drone}=scene();
 const ranked=rankBastionDefenses(g);
 // A contested public border may still justify a tower; its urgency must not
 // originate from a harmless drone's physical proximity.
 for(const front of ranked){
   const sector=g.territories[front.sector];
   if(Math.hypot(sector.point.x-drone.x,sector.point.y-drone.y)<600)
    assert.equal(front.urgent,false);
 }
});
