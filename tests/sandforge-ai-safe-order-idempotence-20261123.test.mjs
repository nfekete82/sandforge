import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';

const make=(version=4)=>{
 const g=new Simulation(20261123,version);
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 assert.ok(home);
 const p=g.world.nearest({x:home.x+230,y:home.y+190},g.obstacles());
 const goal=g.world.nearest({x:home.x+480,y:home.y+430},g.obstacles());
 assert.ok(p&&goal,'test locations must be physical terrain');
 const a=g.spawn(1,p,'infantry');
 const b=g.spawn(1,{x:p.x+22,y:p.y+25},'infantry');
 return {g,a,b,goal};
};
test('only a new safe escort receives a new order; moving soldier retains exact order and A* path',()=>{
 const {g,a,b,goal}=make(4);
 const captured=[],original=g.command.bind(g);
 g.command=(ids,order,...rest)=>{
  captured.push({ids:[...ids],kind:order.kind});
  return original(ids,order,...rest);
 };
 assert.equal(g.tactical.issue([a],goal,'safe',undefined,false,false),true);
 const active=a.orders[0];assert.equal(active?.kind,'move');
 a.path=[{x:goal.x-160,y:goal.y-80},{x:goal.x-60,y:goal.y-35}];
 const route=a.path;
 assert.equal(g.tactical.issue([a,b],goal,'safe',undefined,false,false),true);
 assert.deepEqual(captured.map(x=>x.ids),[[a.id],[b.id]]);
 assert.strictEqual(a.orders[0],active,'existing member must not be re-commanded');
 assert.strictEqual(a.path,route,'moving route must survive a reinforcement');
 assert.equal(b.orders[0]?.kind,'move');
 assert.deepEqual(a.orders[0]?.tactical?.goal,goal);
 assert.deepEqual(b.orders[0]?.tactical?.goal,goal);
 assert.equal(g.tactical.issue([a,b],goal,'safe',undefined,false,false),false,
  'repeating the entire independent group is idempotent');
 assert.equal(captured.length,2);
});
test('coordinated assaults still regroup every member when a reinforcement joins',()=>{
 const {g,a,b,goal}=make(4);
 assert.equal(g.tactical.issue([a],goal,'assault',undefined,false,true),true);
 const previous=a.orders[0];
 assert.equal(g.tactical.issue([a,b],goal,'assault',undefined,false,true),true);
 assert.notStrictEqual(a.orders[0],previous,'coordinated attack metadata must be recomputed');
 assert.equal(b.orders[0]?.kind,'attackMove');
});
test('safe mode remains independent with modern highland campaign map',()=>{
 const {g,a,b,goal}=make(24);
 assert.equal(g.tactical.issue([a],goal,'safe',undefined,false,false),true);
 const previous=a.orders[0];
 assert.equal(g.tactical.issue([a,b],goal,'safe',undefined,false,false),true);
 assert.strictEqual(a.orders[0],previous);
 assert.equal(b.orders[0]?.kind,'move');
});
