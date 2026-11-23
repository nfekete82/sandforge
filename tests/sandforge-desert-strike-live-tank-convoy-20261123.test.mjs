import test from 'node:test';
import assert from 'node:assert/strict';
import '../scripts/webgl-desert-maps.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';

const len=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const map=globalThis.SandforgeDesertMaps.byId('desert-strike');

test('live Desert Strike eight-tank convoy traverses actual central mesa cliff at 1x and 4x',()=>{
 for(const rate of [1,4]){
  const g=Simulation.campaign(map.seed,map.mapVersion,map.terrain,map.generatorVersion);
  g.units=[];g.bases=[];g.territories=[];g.hadBuildings=[false,false];
  g.aiClock=1e8;g.tactical.plan=()=>{};
  const mesa=g.world.generated.plateaus.find(p=>p.siteIndex===-1);
  assert.ok(mesa);
  const clear=Math.max(0,UNITS.tank.radius-10);
  const valid=p=>g.world.walkable(p,[],clear)&&g.world.groundVehicleSlopeSafe(p,.215,UNITS.tank.radius);
  const side=rate===1?-1:1;
  const startR=mesa.rampEnd+340;
  const goalR=mesa.rampEnd+300;
  const goal={x:mesa.center.x-side*goalR,y:mesa.center.y};
  const tanks=[];
  for(let i=0;i<8;i++){
   const p={x:mesa.center.x+side*(startR+(i%2)*90),
    y:mesa.center.y+(i-3.5)*105};
   const spawn=g.world.nearest(p,[],[],undefined,clear,.215);
   assert.ok(spawn&&valid(spawn),'tank spawn invalid '+JSON.stringify({i,p,spawn}));
   const tank=g.spawn(0,spawn,'tank');
   tanks.push(tank);
  }
  const enemySpawn=g.world.nearest({x:600,y:450},[],[],undefined,0,.215);
  g.spawn(1,enemySpawn,'infantry');
  const initial=tanks.map(t=>len(t,goal));
  assert.equal(g.command(tanks.map(t=>t.id),{...goal,kind:'move'}),tanks.length);
  const samples=[],lastProgressAt=tanks.map(()=>0);
  const lastMilestone=initial.slice(),maxNoProgress=tanks.map(()=>0);
  for(let frame=0;frame<2000/rate;frame++){
   for(let tick=0;tick<rate;tick++)g.step(.05);
   for(let i=0;i<tanks.length;i++){
    const remaining=len(tanks[i],goal);
    if(remaining<lastMilestone[i]-80){
     lastMilestone[i]=remaining;lastProgressAt[i]=g.time;
    }
    else if(remaining>500)
     maxNoProgress[i]=Math.max(maxNoProgress[i],g.time-lastProgressAt[i]);
   }
   if(frame%(200/rate)===0){
    samples.push({at:Math.round(g.time),
     distance:tanks.map(t=>Math.round(len(t,goal))),
     x:tanks.map(t=>Math.round(t.x)),
     y:tanks.map(t=>Math.round(t.y)),
     path:tanks.map(t=>t.path.length),
     orders:tanks.map(t=>t.orders.length)});
   }
  }
  const report=tanks.map((tank,i)=>({
    id:tank.id,initial:Math.round(initial[i]),remaining:Math.round(len(tank,goal)),
    longestPause:Math.round(maxNoProgress[i]),
    progress:Math.round(initial[i]-len(tank,goal)),
    at:{x:Math.round(tank.x),y:Math.round(tank.y)},
    order:tank.orders[0]?.kind,path:tank.path[0]?{
     x:Math.round(tank.path[0].x),y:Math.round(tank.path[0].y)
    }:null
  }));
  console.log('DESERT_STRIKE_CONVOY_'+rate+'X '+JSON.stringify({goal,mesa:{center:mesa.center,topRadius:mesa.topRadius,footRadius:mesa.footRadius,rampEnd:mesa.rampEnd},report,samples}));
  for(const t of tanks)assert.ok(g.world.walkable(t,[],clear),'tank penetrated physical cliff');
  const arrived=report.filter(x=>x.remaining<=500).length;
  assert.ok(arrived>=7,'Only '+arrived+'/8 tanks approached the destination within 100s at '+rate+'x; '+JSON.stringify(report));
  const excessivelyStalled=report.filter(x=>x.longestPause>25);
  assert.equal(excessivelyStalled.length,0,
   'Tanks with >25s no meaningful progress at '+rate+'x: '+JSON.stringify(excessivelyStalled));
 }
});
