import test from 'node:test';
import assert from 'node:assert/strict';
import {ai43VerifiedSiegePassApproach} from '../dist/src/reborn/ai36-terrain-routes.js';

const ridge={width:68,height:116,
 spine:[{x:0,y:1000},{x:1500,y:1000},{x:3000,y:1000}],
 ramps:[{x:700,width:250},{x:2300,width:250}]};
const base={
 from:{x:2700,y:2600},target:{x:2650,y:200},
 ridges:[ridge],
 clear:()=>true,
 traversable:()=>true
};

test('physically validated pass chooses the nearest total two-leg siege route',()=>{
 const selected=ai43VerifiedSiegePassApproach(base);
 assert.deepEqual(selected,{x:2300,y:1270});
 // Returning the friendly-side entrance never teleports an attacker.
 assert.ok(selected.y>ridge.spine[0].y);
 assert.deepEqual(ai43VerifiedSiegePassApproach({
  ...base,ridges:[{...ridge,ramps:ridge.ramps.slice().reverse()}]
 }),selected);
});

test('when preferred pass cannot be crossed, try the other real ramp',()=>{
 let calls=0;
 const chosen=ai43VerifiedSiegePassApproach({...base,
  traversable:(a,b)=>{
   calls++;
   return !(a.x===2300&&b.x===2300&&b.y<1000);
  }});
 assert.deepEqual(chosen,{x:700,y:1270});
 assert.ok(calls>=3);
});

test('do not pretend the opposite cliff is reachable without two complete legs',()=>{
 assert.equal(ai43VerifiedSiegePassApproach({...base,
  traversable:(a,b)=>a.x!==b.x}),undefined);
 assert.equal(ai43VerifiedSiegePassApproach({...base,
  clear:p=>p.y>1000}),undefined);
 assert.equal(ai43VerifiedSiegePassApproach({...base,
  traversable:()=>false}),undefined);
});

test('no reroute for a target already on the friendly side of the ridge',()=>{
 assert.equal(ai43VerifiedSiegePassApproach({...base,
  target:{x:350,y:1700}}),undefined);
 assert.equal(ai43VerifiedSiegePassApproach({...base,
  from:{x:2700,y:995}}),undefined);
 assert.equal(ai43VerifiedSiegePassApproach({...base,ridges:[]}),undefined);
});
