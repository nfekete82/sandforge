import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {canyonPassWaypoint,ridgeHeightAtX} from '../dist/src/reborn/ai36-terrain-routes.js';

const sim=new Simulation(824836862,26,false,false,undefined,4);
const w=sim.world;
const from={x:5663,y:4757};
const stalledOrder={x:2809,y:1126};
const ridges=w.generated.ridges;
const ridge=ridges[0],east=ridge.ramps.at(-1);
const side=Math.sign(from.y-ridgeHeightAtX(ridge,from.x));
const center=ridgeHeightAtX(ridge,east.x);

test('real canyon waypoint prefers the accessible right-hand ramp to dead straight line',()=>{
 const p=canyonPassWaypoint(from,stalledOrder,ridges,8,(near,far)=>
  w.line(from,near,[],8,.195)&&w.line(near,far,[],8,.195));
 assert.ok(p,'at least one pass must be reachable');
 assert.ok(Math.abs(p.x-east.x)<1,'vehicle should choose reachable eastern pass');
 assert.ok((p.y-center)*side>0,'waypoint stays on friendly side');
});

test('movement path actually stages through the accessible pass, without teleporting',()=>{
 const approach=w.path(from,stalledOrder,[],8,undefined,false,false,true,.195);
 assert.ok(approach.length,'real vehicle was unable to obtain a first approach route');
 assert.ok(Math.abs(approach.at(-1).x-east.x)<100,'route must end at east pass, not central cliff');
 const near=approach.at(-1);
 const over=w.path(near,stalledOrder,[],8,undefined,false,false,true,.195);
 assert.ok(over.length,'vehicle must continue across ramp');
 assert.ok(Math.abs(over.at(-1).x-east.x)<100);
 assert.ok((over.at(-1).y-center)*side<0,'second leg must end on opposite ridge side');
});

test('no bogus pass when all physical entries are explicitly forbidden',()=>{
 const p=canyonPassWaypoint(from,stalledOrder,ridges,8,()=>false);
 assert.equal(p,undefined);
});
