import test from 'node:test';
import assert from 'node:assert/strict';
import {stickyGuardRoster} from '../dist/src/reborn/sticky-guard-roster.js';

test('a guard remains assigned as his distance to HQ changes after marching',()=>{
 const initial=stickyGuardRoster([11,12,13,14],new Set(),2);
 assert.deepEqual([...initial],[11,12]);
 // The original code sorted solely by distance at every macro pulse;
 // after 11/12 marched forward, 13/14 would steal their home duties.
 const next=stickyGuardRoster([13,14,12,11],initial,2);
 assert.deepEqual([...next],[12,11]);
 assert.deepEqual([...stickyGuardRoster([14,13,12,11],next,2)],[12,11]);
});
test('dead, committed, or otherwise ineligible defenders are replaced cleanly',()=>{
 assert.deepEqual([...stickyGuardRoster([14,12,15],new Set([11,12]),2)],[12,14]);
 assert.deepEqual([...stickyGuardRoster([13,14],new Set([11,12]),1)],[13]);
 assert.deepEqual([...stickyGuardRoster([13,14],new Set([13,14]),0)],[]);
});
test('a real new reserve requirement expands without disturbing existing guards',()=>{
 assert.deepEqual([...stickyGuardRoster([4,2,3,1],new Set([1,3]),3)],[3,1,4]);
});
