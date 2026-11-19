import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {groundedAssaultRouteOrigin} from '../dist/src/reborn/ai36-offensive-routing.js';
import {readFileSync} from 'node:fs';

test('real soldiers, never an unwalkable squad centroid, anchor KI3.6 A*',()=>{
 const game=new Simulation(2026,24);
 game.world.blocked.fill(0);
 game.world.opaque.fill(0);
 game.world.cliffIds.fill(-1);
 game.world.components.fill(0);
 const mean={x:1200,y:1500},units=[
  {id:12,hp:300,x:900,y:1500},
  {id:10,hp:300,x:1500,y:1500}
 ];
 game.world.blocked[game.world.index(mean)]=1;
 assert.equal(game.world.walkable(mean),false);
 const origin=groundedAssaultRouteOrigin(units,mean,p=>game.world.walkable(p));
 assert.equal(game.world.walkable(origin),true);
 assert.deepEqual(origin,{x:1500,y:1500},
  'symmetric distance deterministic tie goes to the lowest ID');
 const route=game.world.path(origin,{x:1600,y:1600},[]);
 assert.ok(route.length>0,'actual live actor position has a valid route');
});

test('low HP and impassable actors cannot be used as fake route sources',()=>{
 const mean={x:500,y:700};
 const soldiers=[
  {id:1,x:500,y:710,hp:0},
  {id:2,x:800,y:710,hp:100},
  {id:3,x:600,y:800,hp:90}
 ];
 assert.deepEqual(groundedAssaultRouteOrigin(soldiers,mean,
  p=>p.x!==600),{x:800,y:710});
});

test('empty formation does not invent a unit or reveal a hidden location',()=>{
 const origin={x:400,y:500};
 assert.deepEqual(groundedAssaultRouteOrigin([],origin,()=>true),origin);
 assert.deepEqual(groundedAssaultRouteOrigin(
  [{id:4,x:600,y:600,hp:100}],origin,()=>false),origin);
});

test('KI3.6 only: AI3.5 preserves the original centroid-based A/B reference',()=>{
 const source=readFileSync('src/reborn/tactical-ai.ts','utf8');
 assert.match(source,/const origin=this\.ai36Enabled\s*\?groundedAssaultRouteOrigin/);
 assert.match(source,/:meanOrigin;/);
 assert.match(source,/routeFallback/);
});

test('HUD smart mode retains fog-safe automatic visibility',async()=>{
 const {showHealthBar}=await import('../scripts/webgl-health.js');
 assert.equal(showHealthBar({mode:'smart',visible:true,selected:false,fraction:1}),false);
 assert.equal(showHealthBar({mode:'smart',visible:true,selected:true,fraction:1}),true);
 assert.equal(showHealthBar({mode:'smart',visible:false,selected:true,fraction:0.3}),false);
});
