import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ai39NoPathRecoveryWaypoint} from '../dist/src/reborn/ai38-vehicle-navigation.js';

const from={x:500,y:500},goal={x:1900,y:500};
const clear=p=>p.x>10&&p.y>10&&p.x<2500&&p.y<2500&&
  !(p.x>555&&p.x<1000&&Math.abs(p.y-500)<90);

test('no-path recovery checks real candidates and drives around a blocked direct lane',()=>{
 const candidate=ai39NoPathRecoveryWaypoint({from,goal,unitId:4,attempt:1,clear});
 assert.ok(candidate);
 assert.equal(clear(candidate),true);
 assert.ok(Math.hypot(candidate.x-from.x,candidate.y-from.y)<=315.001);
 assert.ok(Math.abs(candidate.y-500)>=90,'the blocked forward lane cannot be used');
});

test('no path means no teleport through a cliff: total rejection yields undefined',()=>{
 assert.equal(ai39NoPathRecoveryWaypoint({
  from,goal,unitId:4,attempt:1,clear:()=>false
 }),undefined);
});

test('repeated recovery avoids the earlier origin while retaining bounded steps',()=>{
 const a=ai39NoPathRecoveryWaypoint({from,goal,unitId:5,attempt:1,clear});
 assert.ok(a);
 const b=ai39NoPathRecoveryWaypoint({
  from:a,goal,unitId:5,attempt:2,avoid:from,clear
 });
 assert.ok(b);
 assert.ok(Math.hypot(b.x-from.x,b.y-from.y)>=80);
});

test('recovery is deterministic, verifies terrain itself and does not access fog or cheat',()=>{
 const args={from,goal,unitId:8,attempt:7,clear};
 assert.deepEqual(ai39NoPathRecoveryWaypoint(args),ai39NoPathRecoveryWaypoint(args));
 const src=readFileSync('src/reborn/simulation.ts','utf8');
 const recovery=src.slice(src.indexOf('// KI 3.9: a valid assault order'),
  src.indexOf('// Failed reachability no longer hammers'));
 assert.match(recovery,/!u\.path\.length/);
 assert.match(recovery,/this\.world\.walkable\(/);
 assert.match(recovery,/this\.world\.line\(/);
 assert.match(recovery,/vehicleSpacingGap\(/);
 assert.match(recovery,/this\.tactical\.ai37Mode==='coordinated'/);
 assert.doesNotMatch(recovery,/canSee\(|memories\[|\.credits|\.hp\s*=/);
});
