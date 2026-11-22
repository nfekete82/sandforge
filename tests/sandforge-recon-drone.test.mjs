import {test} from 'node:test';
import assert from 'node:assert/strict';
import {UNITS,canAttack} from '../dist/src/reborn/catalog.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {globalCatalogAvailability} from '../dist/webgl-global-catalog.js';
import {unitRenderAltitude} from '../dist/webgl-scale.js';
import {createReconDrone,animateReconDrone} from '../dist/webgl-recon-drone.js';

test('R-01 is a 50-credit unarmed and exceptionally fast HQ scout',()=>{
 const d=UNITS.drone;
 assert.equal(d.cost,50);
 assert.deepEqual(d.producers,['headquarters']);
 assert.equal(d.flying,true);
 assert.ok(d.hp<=40);
 assert.ok(d.speed>UNITS.bomber.speed);
 assert.ok(d.sight>UNITS.scout.sight);
 assert.equal(d.damage,0);assert.equal(d.range,0);
 assert.equal(canAttack({kind:'drone'},{kind:'tank'}),false);
 assert.ok(unitRenderAltitude('drone')>100);
});
test('finished headquarters unlocks an aircraft tab without an airfield',()=>{
 const game={bases:[{owner:0,kind:'headquarters',hp:1000,buildRemaining:0}]};
 assert.equal(globalCatalogAvailability(game).aircraft,true);
 game.bases[0].buildRemaining=3;
 assert.equal(globalCatalogAvailability(game).aircraft,false);
});
test('R-01 drones have named rotors and independently animated 3D geometry',()=>{
 const model=createReconDrone(0);
 const rotors=[0,1,2,3].map(i=>model.getObjectByName('R01_Rotor_'+i));
 assert.ok(rotors.every(Boolean));
 assert.ok(model.getObjectByName('R01_Camera_Gimbal'));
 const a=rotors.map(r=>r.rotation.y);
 animateReconDrone(model,.05,true);
 assert.ok(rotors.every((r,i)=>r.rotation.y!==a[i]));
 const b=rotors.map(r=>r.rotation.y);
 animateReconDrone(model,.05,false);
 assert.deepEqual(rotors.map(r=>r.rotation.y),b);
});
test('drone can be queued for HQ production and cannot capture a bastion',()=>{
 const game=new Simulation(24081,0);
 const hq=game.bases.find(b=>b.owner===0&&b.kind==='headquarters'&&b.hp>0);
 assert.ok(hq);
 game.credits[0]=100;
 assert.equal(game.recruit(hq.id,'drone'),true);
 assert.equal(game.credits[0],50);
 assert.equal(hq.queueTypes.at(-1),'drone');
 // Ignore the initial ground soldiers so the drone is the sole friendly actor.
 game.units.splice(0);
 const sector=game.territories.find(t=>t.owner!==0);
 assert.ok(sector);
 game.spawn(0,sector.point,'drone');
 assert.equal(game.captureReadiness(sector,0),'no-unit');
});
