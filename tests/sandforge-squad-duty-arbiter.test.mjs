import test from 'node:test';
import assert from 'node:assert/strict';
import {planCombatDuties} from '../dist/src/reborn/squad-duty-arbiter.js';

test('priority conflicts yield one exclusive duty per living eligible unit',()=>{
 const duties=planCombatDuties([9,1,4,6,7,2],{
  defense:new Set([4,1,999]),opening:new Set([1,2,6]),
  recapture:new Set([2,6,7]),raid:new Set([6,7,9])
 });
 assert.deepEqual([...duties.defense],[1,4]);
 assert.deepEqual([...duties.opening],[2,6]);
 assert.deepEqual([...duties.recapture],[7]);
 assert.deepEqual([...duties.raid],[9]);
 assert.equal(duties.owners.size,6);
 assert.equal(duties.owners.has(999),false);
 assert.equal(duties.conflicts.find(c=>c.id===1)?.winner,'defense');
});

test('independent planners remain deterministic without sharing role assignments',()=>{
 const requests={defense:new Set([12,7]),opening:new Set([7,4]),
  recapture:new Set([6,12]),raid:new Set([3,5])};
 const a=planCombatDuties([12,3,7,4,5,6,99],requests);
 const b=planCombatDuties([99,6,5,4,7,3,12],Object.fromEntries(
  Object.entries(requests).map(([k,v])=>[k,new Set([...v].reverse())])));
 assert.deepEqual([...a.owners],[...b.owners]);
 assert.deepEqual([...a.campaign],[99]);
 a.defense.clear();
 assert.deepEqual([...b.defense],[7,12]);
});
