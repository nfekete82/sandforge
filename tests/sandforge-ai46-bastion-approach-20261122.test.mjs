import test from 'node:test';
import assert from 'node:assert/strict';
import {ai46ReachableBastionApproach} from '../dist/src/reborn/ai46-bastion-approach.js';

const circle={x:500,y:500};
test('approach is physically reachable, outside solid Bastion, inside capture radius',()=>{
 let checked=0;
 const p=ai46ReachableBastionApproach({center:circle,from:{x:150,y:500},
  worldSize:1200,captureRadius:125,
  walkable:v=>Math.hypot(v.x-500,v.y-500)>=85,
  completeRoute:v=>{checked++;return v.y<500-20;}});
 assert.ok(p);
 const d=Math.hypot(p.x-500,p.y-500);
 assert.ok(d>85&&d<125,'must remain inside actual capture ring');
 assert.ok(checked>=2,'first candidate cannot bypass route validator');
});
test('does not invent a route when none is complete',()=>{
 const p=ai46ReachableBastionApproach({center:circle,from:{x:100,y:100},
  worldSize:1200,captureRadius:125,walkable:()=>true,completeRoute:()=>false});
 assert.equal(p,undefined);
});
test('refuses unsafe points and map-edge overlaps',()=>{
 const p=ai46ReachableBastionApproach({center:{x:70,y:70},from:{x:10,y:10},
  worldSize:150,captureRadius:125,walkable:()=>true,completeRoute:()=>true});
 assert.equal(p,undefined);
});
test('requires both terrain approval and complete path to return any point',()=>{
 let calls=0;
 const p=ai46ReachableBastionApproach({center:circle,from:{x:150,y:500},
  worldSize:1200,captureRadius:125,walkable:()=>false,
  completeRoute:()=>{calls++;return true;}});
 assert.equal(p,undefined);assert.equal(calls,0);
});
