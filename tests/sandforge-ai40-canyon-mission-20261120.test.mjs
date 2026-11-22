import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseMission,newCampaign} from '../dist/src/reborn/campaign-commander.js';
import {canyonPassWaypoint} from '../dist/src/reborn/ai36-terrain-routes.js';

function scenario(known=true){
 const territories=Array.from({length:16},(_,id)=>({
  id,owner:id<14?1:0,neighbors:id===0?[1]:[id-1,Math.min(15,id+1)],
  point:{x:200+id*300,y:1000},income:25
 }));
 const hq={id:200,x:4700,y:1200,territory:15,hp:1200,
  owner:0,kind:'headquarters'};
 return {
  g:{time:360,world:{mapVersion:26},territories,units:[],
   memories:[[],known?[hq]:[]],canSee:()=>false,
   income:()=>200,credits:[500,1800]},
  hq
 };
}
function options(hq,{breakthrough=true,passRisk=3}={}){
 return {
  strategy:'unknown',force:[],losses:[],fronts:[],
  intelligent:false,bastionControl:false,breakthrough,
  // Two unheld bastions have a complete route. The real observed HQ
  // requires a validated partial physical pass.
  route:p=>Math.abs(p.x-hq.x)<1?undefined:{length:550,risk:0},
  routeFallback:p=>Math.abs(p.x-hq.x)<1?{length:2800,risk:passRisk}:undefined
 };
}
test('proven known HQ siege uses validated partial canyon route despite routable Bastions',()=>{
 const {g,hq}=scenario(true),c=newCampaign();
 const m=chooseMission(g,c,{x:1000,y:1600},options(hq));
 assert.equal(m?.kind,'structure');
 assert.equal(m?.objective,hq.id);
});
test('do not abandon a contested Bastion frontier for an early partial HQ path',()=>{
 const {g,hq}=scenario(true);
 // 11/16 is the classic two-thirds breakthrough threshold, but insufficient
 // for a PARTIAL route that takes the entire force away from active captures.
 for(let i=11;i<14;i++)g.territories[i].owner=0;
 const mission=chooseMission(g,newCampaign(),{x:1000,y:1600},options(hq));
 assert.equal(mission?.kind,'capture');
});
test('no premature HQ rush when the army lacks real breakthrough authorization',()=>{
 const {g,hq}=scenario(true);
 const m=chooseMission(g,newCampaign(),{x:1000,y:1600},options(hq,{breakthrough:false}));
 assert.equal(m?.kind,'capture');
});
test('unknown or unsafe enemy HQ never qualifies for a blind or suicidal attack',()=>{
 const unseen=scenario(false);
 const m=chooseMission(unseen.g,newCampaign(),{x:1000,y:1600},options(unseen.hq));
 assert.equal(m?.kind,'capture');
 const known=scenario(true);
 const n=chooseMission(known.g,newCampaign(),{x:1000,y:1600},
  options(known.hq,{passRisk:17}));
 assert.equal(n?.kind,'capture');
});
test('physical canyon pass has a real checkpoint on the origin side',()=>{
 const ridge={
  spine:[{x:0,y:2000},{x:2500,y:2000},{x:5000,y:2000}],
  width:125,ramps:[{x:800,width:320},{x:4200,width:320}],
  clearings:[]
 };
 const from={x:3200,y:2800},target={x:4500,y:1500};
 const checkpoint=canyonPassWaypoint(from,target,[ridge],12);
 assert.ok(checkpoint);
 assert.ok(checkpoint.y>2000);
 assert.ok(Math.hypot(checkpoint.x-from.x,checkpoint.y-from.y)>100);
});
