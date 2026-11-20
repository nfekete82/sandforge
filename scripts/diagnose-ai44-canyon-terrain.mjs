#!/usr/bin/env node
/** Read-only 16-Bastion canyon route census using the exact seed, v4 terrain,
 * vehicle footprints and bounded A* as the physical 480s benchmark.
 * Nothing is injected into the tactical AI or game simulation. */
import {performance} from 'node:perf_hooks';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {ridgeHeightAtX} from '../dist/src/reborn/ai36-terrain-routes.js';

const round=n=>Math.round(n*100)/100;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const seed=824836862;
const g=new Simulation(seed,26,false,false,undefined,4);
const w=g.world;
const enemyHQ=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
if(!enemyHQ||!w.generated?.ridges.length)throw Error('Expected real HQ and canyon ridge');
const from={x:5663,y:4757}; // Actual blocked paid rover from fixed 480s A/B report
const previousRally={x:2809,y:1126}; // Its actual unpathable move order
const results=[];
for(const kind of ['rover','tank','artillery']){
 const clearance=Math.max(0,UNITS[kind].radius-10);
 const maxSlope=kind==='tank'?.215:kind==='artillery'?.185:.195;
 const path=(a,b)=>{
  const time=performance.now();
  const route=w.path(a,b,[],clearance,undefined,false,false,false,maxSlope);
  return {complete:route.length>0&&distance(route.at(-1),b)<Math.max(35,w.cell*1.4),
   count:route.length,ms:round(performance.now()-time),
   nearestEndpoint:route.at(-1)??null};
 };
 const direct=path(from,enemyHQ);
 const rally=path(from,previousRally);
 for(const ridge of w.generated.ridges){
  const a=from.y-ridgeHeightAtX(ridge,from.x);
  const b=enemyHQ.y-ridgeHeightAtX(ridge,enemyHQ.x);
  for(const ramp of ridge.ramps){
   const y=ridgeHeightAtX(ridge,ramp.x);
   const side=Math.sign(a)||1;
   for(const offset of [270,ridge.width*.5+210]){
    const near={x:ramp.x,y:y+side*offset};
    const far={x:ramp.x,y:y-side*offset};
    const nearWalk=w.walkable(near,[],clearance);
    const farWalk=w.walkable(far,[],clearance);
    const nearSlope=w.terrainSlope(near.x,near.y);
    const farSlope=w.terrainSlope(far.x,far.y);
    const atCenter=w.terrainSlope(ramp.x,y);
    const approach=path(from,near);
    const crossing=path(near,far);
    results.push({kind,rampX:round(ramp.x),width:round(ramp.width),
     offset:round(offset),ridgeWidth:round(ridge.width),startSide:round(a),goalSide:round(b),
     nearWalk,farWalk,nearSlope:round(nearSlope),farSlope:round(farSlope),
     centerSlope:round(atCenter),approach,crossing,
     physicallyCrossable:nearWalk&&farWalk&&approach.complete&&crossing.complete});
   }
  }
 }
 results.push({kind,directHQ:direct,oldRally:rally});
}
const summary={seed,map:26,generator:4,size:w.size,cell:round(w.cell),
 landscape:w.generated?.landscape?.kind??'unknown',from,
 enemyHQ:{x:enemyHQ.x,y:enemyHQ.y,territory:enemyHQ.territory},
 previousRally,results};
console.log('AI44_CANYON_TERRAIN_CENSUS '+JSON.stringify(summary));
