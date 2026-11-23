import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openingCaptureRouteLength}
 from '../dist/src/reborn/ai33-map-doctrine.js';
import {Simulation} from '../dist/src/reborn/simulation.js';

test('complete physical paths have measurable length; partial routes cannot justify an opening capture',()=>{
 const scout={x:0,y:0},goal={x:100,y:0};
 assert.equal(openingCaptureRouteLength(scout,goal,[{x:0,y:900},{x:100,y:900},goal],50),1900);
 assert.equal(openingCaptureRouteLength(scout,goal,[],50),Infinity);
 assert.equal(openingCaptureRouteLength(scout,goal,[{x:1,y:1}],50),Infinity);
 assert.equal(openingCaptureRouteLength(scout,goal,[{x:NaN,y:0}],50),Infinity);
 assert.equal(openingCaptureRouteLength(scout,goal,[goal],50),100);
});
test('real seeded modern opening still reserves a paid reachable infantry scout',()=>{
 const g=Simulation.campaign(9999,24,'oasis',10);
 g.time=3;
 g.tactical.plan();
 const entries=g.tactical.state.openingContests??[];
 assert.ok(entries.length>=1,'normal paid scout opening lost');
 const scout=g.units.find(u=>u.id===entries[0].unitId);
 const site=g.territories.find(t=>t.id===entries[0].sectorId);
 assert.ok(scout&&site&&site.owner===-1);
 const order=scout.orders[0];
 assert.equal(order?.kind,'attackMove');
 assert.ok(Math.hypot(order.x-site.point.x,order.y-site.point.y)<125);
});
test('two-soldier Bastion opening does not repeat identical A* candidate searches',()=>{
 const g=Simulation.campaign(9999,24,'oasis',10);
 g.time=3;
 const red=g.units.find(u=>u.owner===1&&u.kind==='infantry'&&u.hp>0);
 assert.ok(red);
 // Real paid units only; the test uses spawn for the fixture, not in gameplay.
 g.spawn(1,{x:red.x+45,y:red.y+30},'infantry');
 g.spawn(1,{x:red.x+55,y:red.y+45},'infantry');
 const calls=new Map(),original=g.world.path.bind(g.world);
 g.world.path=(from,to,...args)=>{
  const key=[Math.round(from.x),Math.round(from.y),Math.round(to.x),Math.round(to.y)].join(':');
  calls.set(key,(calls.get(key)??0)+1);
  return original(from,to,...args);
 };
 g.tactical.contestOpeningBastions();
 assert.ok(calls.size>0,'must check real reachable front');
 assert.ok([...calls.values()].every(count=>count===1),
  'a two-member capture squad repeated a costly identical A* search');
});
test('a modern paid rover scout receives a vehicle-grade path, not a cliff-bypassing infantry route',()=>{
 const g=Simulation.campaign(9999,24,'oasis',10);
 g.time=3;
 g.units=g.units.filter(u=>u.owner!==1||u.kind==='engineer');
 const worker=g.units.find(u=>u.owner===1);
 assert.ok(worker);
 g.spawn(1,{x:worker.x+75,y:worker.y+80},'rover');
 const requested=[],original=g.world.path.bind(g.world);
 g.world.path=(from,to,...args)=>{
  if(from.kind==='rover')requested.push(args[6]);
  return original(from,to,...args);
 };
 g.tactical.contestOpeningBastions();
 assert.ok(requested.length>0);
 assert.ok(requested.every(x=>x===.195),
  'physical tank/rover grade must be checked by all opening routes');
});
