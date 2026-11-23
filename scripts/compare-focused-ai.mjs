/** Two bounded revision A/B pairs, 180 seconds each. No balance presets.
 * node scripts/compare-focused-ai.mjs /absolute/old/src/reborn/simulation.js
 * Reuses the paid Rush/Contest opponents and existing arena accounting.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Simulation as Candidate} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {runMatch} from './benchmark-reborn-ai.mjs';
import {blueBastionRush,blueContest} from './benchmark-ai-opponent.mjs';
import './webgl-desert-maps.js';

const baselinePath=process.argv[2];
if(!baselinePath)throw Error('Pass the independently compiled main simulation.js path');
const {Simulation:Baseline}=await import(pathToFileURL(resolve(baselinePath)).href);
const output=resolve(process.argv[3]??'ai-arena-results/focused-control.json');
const round=n=>Number(n.toFixed(3));
const ground=new Set(['infantry','heavy','rocket','rover','tank','artillery']);
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');

// Same paid HQ bootstrap as the existing Action benchmark, without importing
// its experimental game rules or controller. No artificial starting bases.
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

function run(Native,map,opponent,label){
 const probes={firstGroundDamage:null,firstRedCapture:null,blueSectors:0,
  idleUnitSeconds:0,combatUnitSeconds:0,idleHeldSeconds:0,
  idleAttackGroupSeconds:0,overlappingDutyDecisions:0,decisions:0,
  recaptureLaunches:0,peakCredits:0,ownership:[]};
 let lastPlan=-Infinity,lastOwnership='',mission=null;
 class Scenario extends Native{
  constructor(seed,version){
   super(seed,version,false,true,map.terrain,map.generatorVersion);
   const strike=this.strike.bind(this);
   this.strike=(source,target,amount)=>{
    const attacker=typeof source==='number'?this.units.find(u=>u.id===source):source;
    const hp=target.hp,result=strike(source,target,amount);
    // Exact damage event against a real hostile ground combatant. Worker,
    // drone, aircraft and building fire cannot start this clock.
    if(attacker&&attacker.owner!==target.owner&&'orders' in attacker&&
      'orders' in target&&ground.has(attacker.kind)&&ground.has(target.kind)&&target.hp<hp)
     probes.firstGroundDamage??=round(this.time);
    return result;
   };
  }
 }
 const metrics=runMatch({Simulation:Scenario,UNITS},{seconds:180,label,opponent,
  defender:g=>{paidBlueHQ(g);(opponent==='bastion-rush'?blueBastionRush:blueContest)(g);},
  observe:g=>{
   const army=g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier&&ground.has(u.kind));
   const idle=army.filter(u=>!u.orders.length&&!u.moving&&!u.combatTarget);
   probes.combatUnitSeconds+=army.length*.05;
   probes.idleUnitSeconds+=idle.length*.05;
   probes.idleHeldSeconds+=idle.filter(u=>u.hold).length*.05;
   probes.peakCredits=Math.max(probes.peakCredits,g.credits[1]);
   const s=g.tactical.state,group=army.filter(u=>s.group.includes(u.id));
   if(s.phase==='attack'&&group.length&&group.every(u=>idle.includes(u)))
    probes.idleAttackGroupSeconds+=.05;
   const ownership=g.territories.map(t=>t.owner).join(',');
   if(ownership!==lastOwnership){
    probes.ownership.push({at:round(g.time),owners:g.territories.map(t=>t.owner)});
    lastOwnership=ownership;
   }
   if(g.territories.filter(t=>t.owner===1).length>1)probes.firstRedCapture??=round(g.time);
   probes.blueSectors=g.territories.filter(t=>t.owner===0).length;
   const recapture=g.tactical.recaptureMission;
   if(recapture&&recapture!==mission)probes.recaptureLaunches++;
   mission=recapture;
   if(s.lastPlan===lastPlan)return;
   lastPlan=s.lastPlan;probes.decisions++;
   const auxiliary=new Set([...(s.openingContests??[]).map(e=>e.unitId),
    ...(s.battle?.squads.filter(q=>q.role==='defense'||q.role==='raid').flatMap(q=>q.ids)??[]),
    ...(recapture?.ids??[])]);
   if(s.phase!=='defend'&&s.group.some(id=>auxiliary.has(id)))
    probes.overlappingDutyDecisions++;
  }},4102,'director',map.mapVersion);
 for(const k of ['idleUnitSeconds','combatUnitSeconds','idleHeldSeconds','idleAttackGroupSeconds','peakCredits'])
  probes[k]=round(probes[k]);
 return {...metrics,probes,idleFraction:round(probes.idleUnitSeconds/Math.max(1,probes.combatUnitSeconds))};
}

const report={schema:'sandforge-focused-ai-revision-ab-v1',seconds:180,seed:4102,
 baselineSimulationHash:hash(baselinePath),
 candidateSimulationHash:hash(new URL('../dist/src/reborn/simulation.js',import.meta.url)),
 baselineTacticalHash:hash(new URL('./tactical-ai.js',pathToFileURL(resolve(baselinePath)))),
 candidateTacticalHash:hash(new URL('../dist/src/reborn/tactical-ai.js',import.meta.url)),
 opponentHash:hash(new URL('./benchmark-ai-opponent.mjs',import.meta.url)),pairs:[]};
for(const [id,opponent] of [['desert-strike','bastion-rush'],['broken-empire','contesting']]){
 const map=globalThis.SandforgeDesertMaps.byId(id);
 const before=run(Baseline,map,opponent,'main');
 console.log('Completed main:',id,'seed 4102, 180s');
 const after=run(Candidate,map,opponent,'candidate');
 assert.equal(before.initialStateHash,after.initialStateHash,'identical playable world, fog, units and credits');
 const pair={map:id,opponent,before,after};report.pairs.push(pair);
 mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({map:id,before:{bastions:before.redSectors,credits:before.redCredits,
  losses:before.redUnitsLost,...before.probes},after:{bastions:after.redSectors,
  credits:after.redCredits,losses:after.redUnitsLost,...after.probes}}));
}
