import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planCombatDuties} from '../dist/src/reborn/squad-duty-arbiter.js';
import {Simulation} from '../dist/src/reborn/simulation.js';

const req=(extra={})=>({
 defense:new Set(),opening:new Set(),recapture:new Set(),raid:new Set(),...extra
});

test('one real paid combatant receives exactly one macro role',()=>{
 const duties=planCombatDuties([9,1,4,6,7,2],req({
  defense:new Set([4,1]),
  opening:new Set([1,2,6]),
  recapture:new Set([2,6,7]),
  raid:new Set([6,7,9])
 }));
 assert.deepEqual([...duties.defense],[1,4]);
 assert.deepEqual([...duties.opening],[2,6]);
 assert.deepEqual([...duties.recapture],[7]);
 assert.deepEqual([...duties.raid],[9]);
 assert.deepEqual([...duties.campaign],[]);
 const groups=['defense','opening','recapture','raid','campaign'];
 const members=groups.flatMap(role=>[...duties[role]]);
 assert.equal(new Set(members).size,6);
 assert.deepEqual(duties.conflicts,[
  {id:1,winner:'defense',displaced:'opening'},
  {id:2,winner:'opening',displaced:'recapture'},
  {id:6,winner:'opening',displaced:'recapture'},
  {id:6,winner:'opening',displaced:'raid'},
  {id:7,winner:'recapture',displaced:'raid'}
 ]);
});

test('defense preempts old scout and campaign without touching other real units',()=>{
 const duties=planCombatDuties([2,5,7,9],req({
  defense:new Set([7]),opening:new Set([7,5]),
  recapture:new Set(),raid:new Set([2])
 }));
 assert.deepEqual([...duties.defense],[7]);
 assert.deepEqual([...duties.opening],[5]);
 assert.deepEqual([...duties.raid],[2]);
 assert.deepEqual([...duties.campaign],[9]);
 assert.equal(duties.conflicts[0].winner,'defense');
 const updatedOpening=[{unitId:5},{unitId:7}].filter(e=>
  !duties.conflicts.filter(v=>v.displaced==='opening').some(v=>v.id===e.unitId));
 assert.deepEqual(updatedOpening,[{unitId:5}]);
});

test('recovery/boarding/medics remain outside eligible combat roster',()=>{
 const duties=planCombatDuties([2,3,5,2,NaN,-1],req({
  defense:new Set([99,3]),opening:new Set([5,100]),
  recapture:new Set([99]),raid:new Set([2])
 }));
 assert.deepEqual([...duties.defense],[3]);
 assert.deepEqual([...duties.opening],[5]);
 assert.deepEqual([...duties.raid],[2]);
 assert.equal(duties.owners.has(99),false);
 assert.equal(duties.owners.has(100),false);
 assert.equal(duties.owners.size,3);
});

test('ownership is deterministic regardless of input Set insertion order',()=>{
 const input=[12,3,7,4,5,6];
 const a=planCombatDuties(input,req({
  defense:new Set([7,12]),opening:new Set([4,7]),
  recapture:new Set([6,12]),raid:new Set([3,5])
 }));
 const b=planCombatDuties([...input].reverse(),req({
  defense:new Set([12,7]),opening:new Set([7,4]),
  recapture:new Set([12,6]),raid:new Set([5,3])
 }));
 for(const duty of ['defense','opening','recapture','raid','campaign'])
  assert.deepEqual([...a[duty]],[...b[duty]]);
 assert.deepEqual(a.conflicts,b.conflicts);
});

test('real Director uses the arbiter instead of leaving overlapping scout and emergency orders',()=>{
 const source=readFileSync('src/reborn/tactical-ai.ts','utf8');
 assert.match(source,/const frontline=planCombatDuties\(/);
 assert.match(source,/const duties=planCombatDuties\(/);
 assert.match(source,/s\.openingContests=.*\.filter\(e=>!seized\.has\(e\.unitId\)\)/);
 assert.match(source,/s\.group=s\.group\.filter\(id=>duties\.campaign\.has\(id\)\)/);
 assert.match(source,/q\.role==='defense'&&q\.ids\.includes\(u\.id\)/);
 assert.match(source,/!u\.orders\.some\(o=>\['garrison','board','build','repair'\]/);
 const g=new Simulation(4102,24);
 assert.equal(g.status,'playing');
 assert.ok(g.units.some(u=>u.owner===1&&u.kind==='infantry'));
});
