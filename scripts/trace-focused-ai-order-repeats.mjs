#!/usr/bin/env node
/**
 * Single 180s observed diagnostic. One seed, one already-known failing map.
 * Does not alter AI decisions or 1v1 rules. Trace the exact caller sites of
 * same-target command requests, not merely a global duplicate counter.
 */
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {runMatch} from './benchmark-reborn-ai.mjs';
import {blueContest} from './benchmark-ai-opponent.mjs';
import './webgl-desert-maps.js';

const map=globalThis.SandforgeDesertMaps.byId('broken-empire');
if(!map)throw Error('Missing Broken Empire map');
const repeated=[];
let total=0;
class Traced extends Simulation{
 constructor(seed,version){
  super(seed,version,false,true,map.terrain,map.generatorVersion);
  this.lastAiCommands=new Map();
 }
 command(ids,order,...rest){
  const signature=JSON.stringify({
   kind:order.kind,target:order.target,
   x:Math.round(order.x??0),y:Math.round(order.y??0)
  });
  const forAI=ids.filter(id=>this.units.some(u=>u.id===id&&u.owner===1&&u.hp>0));
  for(const id of forAI){
   total++;
   const prior=this.lastAiCommands.get(id);
   if(prior?.signature===signature){
    const unit=this.units.find(u=>u.id===id);
    const actual=unit?.orders[0];
    const live=!!actual&&actual.kind===order.kind&&actual.target===order.target&&
     Math.hypot(actual.x-order.x,actual.y-order.y)<2;
    const caller=(new Error().stack??'').split('\n').find(line=>
     /TacticalAI\.|developArmy|Campaign|ai33|Recapture/.test(line))?.trim()??'unknown';
    repeated.push({
     at:Number(this.time.toFixed(2)),id,kind:order.kind,
     dt:Number((this.time-prior.time).toFixed(2)),
     live,hasPath:(unit?.path.length??0)>0,moving:!!unit?.moving,
     blockedHold:!!unit?.hold,
     caller,priorCaller:prior.caller,
     signature
    });
   }
   const caller=(new Error().stack??'').split('\n').find(line=>
    /TacticalAI\.|developArmy|Campaign|ai33|Recapture/.test(line))?.trim()??'unknown';
   this.lastAiCommands.set(id,{signature,time:this.time,caller});
  }
  return super.command(ids,order,...rest);
 }
}
function paidBlueHQ(g){
 if(!g.needsHeadquarters(0))return;
 const worker=g.units.find(u=>u.owner===0&&u.kind==='engineer'&&u.hp>0);
 if(!worker)return;
 const home=g.startRegions[0].center;
 for(const r of [0,85,155,215,280,340])for(let k=0;k<24;k++){
  const a=k*Math.PI/12,p={x:home.x+Math.cos(a)*r,y:home.y+Math.sin(a)*r};
  if(!g.buildError(0,'headquarters',p)&&g.build(0,'headquarters',p,[worker.id]))return;
 }
}
const metrics=runMatch({Simulation:Traced,UNITS},{
 seconds:180,label:'order-diagnostic',opponent:'contesting',
 defender:g=>{paidBlueHQ(g);blueContest(g);}
},4102,'director',map.mapVersion);
const groups=new Map();
for(const v of repeated){
 const key=v.caller+'|'+v.kind+'|live='+v.live;
 const g=groups.get(key)??{count:0,first:v.at,last:v.at,liveMoving:0,atRest:0};
 g.count++;g.last=v.at;
 if(v.live&&(v.hasPath||v.moving))g.liveMoving++;
 if(!v.hasPath&&!v.moving)g.atRest++;
 groups.set(key,g);
}
const summary=[...groups].map(([key,data])=>({key,...data}))
 .sort((a,b)=>b.count-a.count);
console.log('ORDER_REPEAT_TRACE '+JSON.stringify({
 seed:4102,map:'broken-empire',seconds:180,allCommandedUnits:total,
 repeatedByLastRequest:repeated.length,redOwnedBastions:metrics.redSectors,
 summary,firstEvents:repeated.slice(0,12)
}));
