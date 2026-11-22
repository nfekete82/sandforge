import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {
 ai45ChooseReachableSiegeRally,ai45CanRelocateStuckSiege
} from '../dist/src/reborn/ai45-reachable-siege-rally.js';

test('only current physical plateau maps permit this safe siege rally recovery',()=>{
 const normal={mapVersion:26,generatorVersion:10,seed:1907,
  missionKind:'structure',objectiveObserved:true,homePressure:false,
  fighters:12,phase:'gather',gatherSeconds:180,
  lastAttemptAgo:180,readyAtRally:0,canReachRally:10};
 assert.equal(ai45CanRelocateStuckSiege(normal),true,
  '145+ seconds of missed assembly justify a new validated approach');
 for(const bad of [
  {generatorVersion:9},{generatorVersion:5},
  {missionKind:'capture'},{missionKind:'hunt'},
  {objectiveObserved:false},{homePressure:true},
  {fighters:7},{phase:'attack'},
  {gatherSeconds:70},{lastAttemptAgo:12},{readyAtRally:5}
 ])assert.equal(ai45CanRelocateStuckSiege({...normal,...bad}),false,
  JSON.stringify(bad));
 assert.equal(ai45CanRelocateStuckSiege({
  ...normal,generatorVersion:7,seed:271121
 }),true,'only authored v7 Mesa Highlands keeps a compatible safe route');
 assert.equal(ai45CanRelocateStuckSiege({
  ...normal,generatorVersion:7,seed:2026
 }),false,'not every legacy generator v7 world may change');
});

test('reachable but empty rally after 95s permits only a validated candidate search',()=>{
 const x={mapVersion:26,generatorVersion:10,seed:1907,
  missionKind:'structure',objectiveObserved:true,homePressure:false,
  fighters:12,phase:'gather',gatherSeconds:98,lastAttemptAgo:98,
  readyAtRally:0,canReachRally:12};
 assert.equal(ai45CanRelocateStuckSiege(x),true,
  'real 480s diagnostic: all 12 routes exist but nobody assembled at 98s');
 for(const bad of [
  {gatherSeconds:94},{readyAtRally:1},{phase:'attack'},
  {homePressure:true},{objectiveObserved:false},{lastAttemptAgo:44}
 ])assert.equal(ai45CanRelocateStuckSiege({...x,...bad}),false,
  'never change progressing or unsafe assault: '+JSON.stringify(bad));
 assert.equal(ai45CanRelocateStuckSiege({...x,readyAtRally:1,gatherSeconds:145}),true,
  'existing 145s timeout still handles partial but incomplete assembly');
});

test('choose a real 4-fighter cluster with validated approach, not an isolated Bastion',()=>{
 const fighters=Array.from({length:10},(_,i)=>({
  id:i,x:1000+(i%5)*16,y:1200+Math.floor(i/5)*16
 }));
 const blocked={x:2800,y:2300},good={x:1090,y:1260},goal={x:3100,y:3000};
 const seen=[];
 const chosen=ai45ChooseReachableSiegeRally({
  candidates:[blocked,good],
  fighters,objective:goal,
  safe:()=>true,
  reachable:(from,to)=>Math.hypot(from.x-to.x,from.y-to.y)<210,
  siegeApproachReachable:p=>{seen.push(p);return p.x<2000;}
 });
 assert.deepEqual(chosen,good);
 assert.deepEqual(seen,[good],'do not request siege route for a physically isolated rally');
 assert.equal(ai45ChooseReachableSiegeRally({
  candidates:[good],fighters,objective:goal,
  safe:()=>true,reachable:()=>true,siegeApproachReachable:()=>false
 }),undefined,'never treat an unvalidated path across a cliff as a real siege route');
 assert.equal(ai45ChooseReachableSiegeRally({
  candidates:[good],fighters,objective:goal,
  safe:()=>false,reachable:()=>true,siegeApproachReachable:()=>true
 }),undefined,'never put a rally in a cliff or known turret killzone');
});

test('candidate controller uses observed memory, complete real A-star paths and no spawning',()=>{
 const src=readFileSync('src/reborn/tactical-ai.ts','utf8');
 assert.match(src,/ai45CanRelocateStuckSiege/);
 assert.match(src,/ai45ChooseReachableSiegeRally/);
 assert.match(src,/mission\.kind==='structure'/);
 assert.match(src,/this\.ai45SiegeRallyRetryAt=g\.time\+45/);
 assert.match(src,/g\.world\.line\(aim,intel,lineBlockers,10\)/);
 assert.match(src,/const completeRallyRoute=\(from:Point,to:Point\):boolean=>/);
 assert.match(src,/distance\(path\[path\.length-1\],to\)<=g\.world\.cell\*2/);
 assert.match(src,/reachable:completeRallyRoute/);
 assert.match(src,/const path=this\.route\(p,aim\)/);
 assert.match(src,/distance\(path\[path\.length-1\],aim\)>g\.world\.cell\*2/);
 assert.match(src,/this\.sampleRoute\(path,p\)\.risk>=20/);
 assert.match(src,/this\.ai45RallyRescues\+\+/);
 const game=new Simulation(1907,26,false,false,'dunes',10);
 assert.equal(game.tactical.ai45RallyRescues,0);
 assert.equal(game.tactical.mode,'director');
 assert.equal(game.credits[0],game.credits[1]);
 const old=new Simulation(1907,26,false,false,'dunes',9);
 assert.equal(old.tactical.ai45RallyRescues,0);
 assert.equal(old.world.generatorVersion,9);
});
