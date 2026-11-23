/** Real 20-Hz AI planning profile. No mocks, free units, hidden enemy access,
 * gameplay flags or state mutation other than read-only path timing enabled.
 * Compare deterministic state with main; duration and allocations are not
 * deterministic, report medians and hot spots rather than promises.
 */
import './webgl-desert-maps.js';
import {performance} from 'node:perf_hooks';
import {Simulation} from '../dist/src/reborn/simulation.js';

const refs=(process.env.AI_SPIKE_MAPS??'desert-strike,broken-empire,burning-horizon')
 .split(',').map(s=>s.trim()).filter(Boolean);
const duration=Number(process.env.AI_SPIKE_SECONDS??7.1);
if(!(duration>=3.1&&duration<=180))throw Error('invalid AI_SPIKE_SECONDS');
const reps=Number(process.env.AI_SPIKE_REPS??2);
if(!Number.isSafeInteger(reps)||reps<1||reps>6)throw Error('invalid AI_SPIKE_REPS');

for(const ref of refs){
 const map=globalThis.SandforgeDesertMaps.byId(ref);
 if(!map)throw Error('Unknown map '+ref);
 for(let repetition=0;repetition<reps;repetition++){
  const g=Simulation.campaign(map.seed,map.mapVersion,map.terrain,map.generatorVersion);
  g.world.profilePaths=true;
  let maxStep=0,spikes=[],profile=[];
  for(let tick=0;tick<Math.ceil(duration/.05)&&g.status==='playing';tick++){
   const beforeCalls=g.world.pathCalls,beforeNodes=g.world.pathVisitedNodes,
    beforePathMs=g.world.pathCostMs;
   const at=performance.now();
   g.step(.05);
   const elapsed=performance.now()-at;
   if(elapsed>maxStep)maxStep=elapsed;
   const calls=g.world.pathCalls-beforeCalls,
    nodes=g.world.pathVisitedNodes-beforeNodes,
    pathMs=g.world.pathCostMs-beforePathMs;
   if(calls>0||elapsed>10){
    const entry={time:Number(g.time.toFixed(2)),
     stepMs:Number(elapsed.toFixed(3)),pathCalls:calls,
     pathMs:Number(pathMs.toFixed(3)),pathNodes:nodes};
    profile.push(entry);
   }
   spikes.push({time:Number(g.time.toFixed(2)),stepMs:elapsed,calls,nodes,pathMs});
  }
  const top=spikes.sort((a,b)=>b.stepMs-a.stepMs).slice(0,8)
   .map(x=>({time:x.time,stepMs:Number(x.stepMs.toFixed(3)),
     calls:x.calls,pathMs:Number(x.pathMs.toFixed(3)),nodes:x.nodes}));
  const result={map:ref,seed:map.seed,repetition,
   played:Number(g.time.toFixed(2)),status:g.status,
   pathCalls:g.world.pathCalls,pathNodes:g.world.pathVisitedNodes,
   pathMs:Number(g.world.pathCostMs.toFixed(3)),
   maxStepMs:Number(maxStep.toFixed(3)),
   top,profile,
   state:{
    time:g.time,status:g.status,credits:g.credits,
    territories:g.territories.map(t=>[t.id,t.owner,t.capturing,Number(t.progress.toFixed(4))]),
    bases:g.bases.map(b=>[b.id,b.owner,b.kind,b.hp,b.buildRemaining]),
    units:g.units.map(u=>[u.id,u.owner,u.kind,Number(u.x.toFixed(4)),
     Number(u.y.toFixed(4)),u.hp,u.orders.map(o=>[o.kind,o.x,o.y,o.target])])
   }};
  console.log('AI_SPIKE '+JSON.stringify(result));
 }
}
