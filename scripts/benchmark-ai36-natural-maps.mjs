#!/usr/bin/env node
/** Paired, deterministic natural-map AI 3.5 vs AI 3.6 smoke benchmark.
 * Real paid economy, fog, terrain, game clock and captures. Runtime-only
 * AI36 on/off toggle; no starting troops, cheats or map modifications.
 * Results measure outcomes, not guaranteed improvement.
 */
import {mkdirSync,writeFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';

const rounds=[
 {version:24,seed:2077,profile:'mixed'},
 {version:26,seed:42102026,profile:'rocky'}
];
const simSeconds=Number(process.env.SANDFORGE_BENCH_SECONDS??140);
if(!Number.isFinite(simSeconds)||simSeconds<90||simSeconds>600)
 throw Error('SANDFORGE_BENCH_SECONDS must be 90-600');
const step=.05;
const rows=[];
for(const item of rounds){
 let startingState=null;
 for(const mode of ['off','coordinated']){
  const game=Simulation.campaign(item.seed,item.version,item.profile,3);
  game.stageWebGLProduction=true;
  game.tactical.mode='director';
  game.tactical.ai35Mode='control';
  game.tactical.ai36Mode=mode;
  game.paused=false;
  const save=JSON.stringify(game.save());
  if(startingState!==null&&startingState!==save)
   throw Error('A/B comparisons did not start from identical gameplay state');
  startingState=save;
  let redControl=0,blueControl=0,captured=0,previous=new Set();
  const frames=Math.ceil(simSeconds/step);
  for(let k=0;k<frames;k++){
   if(game.status==='playing')game.step(step);
   const red=game.territories.filter(t=>t.owner===1);
   const blue=game.territories.filter(t=>t.owner===0);
   redControl+=red.length*step;blueControl+=blue.length*step;
   const newOwners=new Set(red.map(t=>t.id));
   for(const id of newOwners)if(!previous.has(id))captured++;
   previous=newOwners;
  }
  const row={...item,generatorVersion:game.world.generatorVersion,
   ai36Mode:mode,seconds:simSeconds,gameSeconds:Number(game.time.toFixed(1)),
   status:game.status,redControlSeconds:Math.round(redControl),
   blueControlSeconds:Math.round(blueControl),redCaptureEvents:captured,
   redFinalSectors:game.territories.filter(t=>t.owner===1).length,
   blueFinalSectors:game.territories.filter(t=>t.owner===0).length,
   redUnits:game.units.filter(u=>u.owner===1&&u.hp>0).length,
   redCredits:Math.round(game.credits[1]),redPaidBases:game.bases.filter(b=>b.owner===1&&b.hp>0).length};
  rows.push(row);
  console.log(JSON.stringify(row));
 }
}
const pairs=rounds.map(item=>{
 const same=rows.filter(row=>row.version===item.version&&row.seed===item.seed);
 const old=same.find(x=>x.ai36Mode==='off');
 const current=same.find(x=>x.ai36Mode==='coordinated');
 return {version:item.version,seed:item.seed,profile:item.profile,
  deltaRedControlSeconds:current.redControlSeconds-old.redControlSeconds,
  deltaRedFinalSectors:current.redFinalSectors-old.redFinalSectors,
  deltaRedUnits:current.redUnits-old.redUnits};
});
const report={scope:'Paired 140s-class real paid AI smoke test on generator v3; not a statistically significant win rate',step,seconds:simSeconds,pairs,rows};
mkdirSync('docs/qa/ai36-terrain',{recursive:true});
writeFileSync('docs/qa/ai36-terrain/paired-smoke.json',JSON.stringify(report,null,2)+'\n');
console.log('Summary '+JSON.stringify(pairs));
