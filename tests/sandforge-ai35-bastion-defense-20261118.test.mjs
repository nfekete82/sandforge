import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {bastionGuardPriority,bastionGarrisonReserve,observedDefensePriority,publicBastionDeficit} from '../dist/src/reborn/ai35-bastion-doctrine.js';
import {parseOptions,runMatch} from '../scripts/benchmark-reborn-ai.mjs';
import {UNITS} from '../dist/src/reborn/catalog.js';

test('3.5 urgently guards a Bastion being captured without revealing hidden troops',()=>{
 const safe={id:1,income:35,capturing:-1,progress:0,enemyAdjacent:true,visibleRaiders:0};
 const held={...safe,id:2,capturing:0,progress:3};
 assert.ok(bastionGuardPriority(held)>bastionGuardPriority(safe));
 assert.ok(bastionGuardPriority({...safe,visibleRaiders:2})>bastionGuardPriority(safe));
 assert.ok(bastionGuardPriority({...safe,income:35})>bastionGuardPriority({...safe,income:15}));
 assert.equal(bastionGuardPriority(safe),bastionGuardPriority({...safe}),
  'ranking is pure and independent of hidden positions');
});
test('3.5 prioritizes visible attackers on a capture ring, but never ignores an HQ invasion',()=>{
 const distant={distanceToAsset:90,distanceToHQ:900,kind:'infantry',
  endangeredIncome:35,insideCaptureRing:false};
 const capture={...distant,distanceToAsset:120,insideCaptureRing:true};
 const nearHQ={...distant,distanceToAsset:80,distanceToHQ:95};
 assert.ok(observedDefensePriority(capture)<observedDefensePriority(distant));
 assert.ok(observedDefensePriority(nearHQ)<observedDefensePriority(capture));
 assert.ok(observedDefensePriority({...capture,endangeredIncome:35})<
   observedDefensePriority({...capture,endangeredIncome:15}));
});
test('3.5 applies public-control deficit only to opt-in eight/sixteen Bastions',()=>{
 assert.equal(publicBastionDeficit(24,4,1),true);
 assert.equal(publicBastionDeficit(26,6,2),true);
 assert.equal(publicBastionDeficit(24,3,2),false);
 assert.equal(publicBastionDeficit(26,2,0),false);
 assert.equal(publicBastionDeficit(25,9,1),false);
 assert.equal(publicBastionDeficit(23,3,0),false);
});
test('3.5 URL and CLI policies preserve exact 3.4 comparison on one binary',()=>{
 assert.equal(parseOptions(['--ai35','off']).ai35,'off');
 assert.equal(parseOptions(['--ai35','control']).ai35,'control');
 assert.throws(()=>parseOptions(['--ai35','cheat']),/Invalid benchmark options/);
 const menu=readFileSync('scripts/webgl-title-menu.js','utf8');
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 assert.match(menu,/params\.set\('ai35',query\.get\('ai35'\)\)/);
 assert.match(preview,/game\.tactical\.ai35Mode=query\.get\('ai35'\)/);
 const a=new Simulation(2026,24),b=new Simulation(2026,24);
 a.tactical.ai35Mode='off';b.tactical.ai35Mode='control';
 assert.deepEqual(a.credits,b.credits);
 assert.deepEqual(a.units,b.units,'no free or changed soldiers');
 assert.deepEqual(a.territories,b.territories,'no privileged territories');
 const before=a.units.filter(u=>u.kind==='drone');
 assert.equal(before.length,b.units.filter(u=>u.kind==='drone').length);
});
test('3.5 remains runtime-only, no saved-game policy leakage',()=>{
 const g=new Simulation(2026,24);g.tactical.ai35Mode='control';
 const save=g.save();
 assert.equal(JSON.stringify(save).includes('ai35Mode'),false);
 const restored=Simulation.load(save);
 assert.equal(restored.tactical.ai35Mode,'control');
});
test('3.5 does not reintroduce transport-supply or drone strategic threat',()=>{
 const t=readFileSync('src/reborn/tactical-ai.ts','utf8');
 assert.doesNotMatch(t,/generateSupplyCaches|supplyLogistics\.advance/);
 assert.match(t,/u\.kind!=='drone'/);
 assert.match(t,/bastionControl:this\.ai35Enabled/);
 assert.match(t,/bastionGuardPriority\(/);
 assert.match(t,/observedDefensePriority\(/);
});

test('humanlike Bastion rush uses only legal paid recruits and leaves a HQ defender',async()=>{
 const {blueBastionRush}=await import('../scripts/benchmark-ai-opponent.mjs');
 const g=new Simulation(2026,24);
 const starting=g.credits[0],startingIds=g.units.map(u=>u.id);
 // Clear terrain for deterministic fixture, never fabricate troops or credits.
 g.world.blocked.fill(0);g.world.opaque.fill(0);g.world.components.fill(0);
 g.time=95;
 blueBastionRush(g);
 assert.ok(g.credits[0]<=starting,'all production must be paid');
 assert.deepEqual(g.units.map(u=>u.id),startingIds,'no free soldiers are spawned by opponent controller');
 assert.equal(g.units.filter(u=>u.owner===0&&u.hp>0&&u.kind==='engineer').length>=1,true);
 assert.equal(parseOptions(['--opponent','bastion-rush']).opponent,'bastion-rush');
});

test('3.5 allocates only paid Bastion sentries while retaining two or three HQ guards',()=>{
 assert.equal(bastionGarrisonReserve(24,2,8),3);
 assert.equal(bastionGarrisonReserve(24,2,7),0);
 assert.equal(bastionGarrisonReserve(26,3,10),4);
 assert.equal(bastionGarrisonReserve(26,3,9),0);
 assert.equal(bastionGarrisonReserve(26,1,20),0);
 assert.equal(bastionGarrisonReserve(25,5,20),0);
 assert.equal(bastionGarrisonReserve(23,4,20),0);
 const tactical=readFileSync('src/reborn/tactical-ai.ts','utf8');
 assert.match(tactical,/controlReserve=this\.ai35Enabled/);
 assert.match(tactical,/policy\?\.guards\?\?0,controlReserve/);
});
