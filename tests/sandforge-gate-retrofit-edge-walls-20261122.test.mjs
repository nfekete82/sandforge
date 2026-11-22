import test from 'node:test';
import assert from 'node:assert/strict';
import {wallDragSegments,gateRetrofitAt,WALL_CHAIN_PITCH,WALL_EDGE_LONG} from '../scripts/webgl-wall-drag.js';

test('horizontal wall drag reaches the playable right edge with full-size sections',()=>{
 const size=3200;
 const items=wallDragSegments({x:495,y:600},{x:size,y:600},size,{axis:'x'});
 assert.ok(items.length>1);
 assert.equal(items.at(-1).point.x,size-WALL_EDGE_LONG);
 assert.ok(items.every((part,i)=>i===0||
  Math.abs(part.point.x-items[i-1].point.x)===WALL_CHAIN_PITCH));
});
test('vertical wall drag reaches top/left boundary with full-size sections',()=>{
 const size=3200;
 const items=wallDragSegments({x:600,y:1450},{x:600,y:0},size,{axis:'y'});
 assert.ok(items.length>1);
 assert.equal(items.at(-1).point.y,WALL_EDGE_LONG);
 assert.ok(items.every((part,i)=>i===0||
  Math.abs(part.point.y-items[i-1].point.y)===WALL_CHAIN_PITCH));
});
test('ordinary wall drag does not snap to a distant border',()=>{
 const items=wallDragSegments({x:300,y:400},{x:900,y:400},3200,{axis:'x'});
 assert.equal(items[0].point.x,300);
 assert.ok(items.at(-1).point.x<=900);
});
test('retrofit only recognizes an adjacent finished pair and snaps to its midpoint',()=>{
 const game={bases:[
  {id:1,owner:0,kind:'wall',hp:100,buildRemaining:0,x:600,y:500,facing:0},
  {id:2,owner:0,kind:'wall',hp:100,buildRemaining:0,x:709,y:500,facing:0},
  {id:3,owner:1,kind:'wall',hp:100,buildRemaining:0,x:800,y:500,facing:0}
 ],findWallGatePartner(owner,id){
  const wall=this.bases.find(b=>b.owner===owner&&b.id===id);
  return this.bases.find(b=>b.id!==id&&b.owner===owner&&b.kind==='wall'&&
   b.buildRemaining===0&&Math.abs(b.x-wall.x)===109&&b.y===wall.y)??null;
 }};
 const target=gateRetrofitAt(game,{x:658,y:520},0);
 assert.equal(target?.center.x,654.5);
 assert.equal(target?.center.y,500);
 assert.equal(target?.wall.owner,0);
 assert.equal(gateRetrofitAt(game,{x:1300,y:500},0),null);
 game.bases[1].buildRemaining=10;
 assert.equal(gateRetrofitAt(game,{x:658,y:520},0),null);
});
