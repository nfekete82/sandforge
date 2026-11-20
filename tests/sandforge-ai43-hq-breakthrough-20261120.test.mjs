import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../scripts/webgl-desert-maps.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {chooseMission,newCampaign} from '../dist/src/reborn/campaign-commander.js';
import {ai43OffensiveHqBreakthrough,ai43KeepKnownHqMission} from '../dist/src/reborn/ai43-hq-breakthrough.js';

const maps=globalThis.SandforgeDesertMaps.maps;
const strong={time:235,totalBastions:16,ownedBastions:15,
 knownLivingHQ:true,liveHQContact:true,mobileFighters:14,healthyMobile:11,artillery:2,
 observedHomeThreat:false,recentLosses:1};
test('KI43: only a genuinely discovered and combat-ready HQ can trigger an offensive siege',()=>{
 assert.equal(ai43OffensiveHqBreakthrough(strong),true);
 assert.equal(ai43OffensiveHqBreakthrough({...strong,ownedBastions:14}),false,
  '14/16 must NOT abandon winning Bastion siege for a risky HQ pivot');
 assert.equal(ai43OffensiveHqBreakthrough({...strong,totalBastions:8,ownedBastions:7}),true,
  'on open 8-sector desert, 7 genuinely held Bastions suffice');
 assert.equal(ai43OffensiveHqBreakthrough({...strong,totalBastions:12,ownedBastions:11}),true,
  'on 12-sector desert, preserve the final Bastion frontier');
 for(const overrides of [
  {time:164},{totalBastions:3},{ownedBastions:11},
  {knownLivingHQ:false},{liveHQContact:false},
  {mobileFighters:8},{healthyMobile:6},
  {artillery:0},{observedHomeThreat:true},{recentLosses:4}
 ])assert.equal(ai43OffensiveHqBreakthrough({...strong,...overrides}),false,
  'must not enter blind/suicidal HQ push '+JSON.stringify(overrides));
});
test('KI43: HQ commitment keeps only the known, living matching target',()=>{
 const x={breakthrough:true,rememberedKind:'headquarters',
  rememberedId:101,activeObjective:101};
 assert.equal(ai43KeepKnownHqMission(x),true);
 for(const changes of [{breakthrough:false},{rememberedKind:'turret'},
  {rememberedKind:undefined},{rememberedId:102},{activeObjective:null}])
  assert.equal(ai43KeepKnownHqMission({...x,...changes}),false,
   'other objectives cannot hijack this siege: '+JSON.stringify(changes));
});
function stagedScenario(known=true){
 const territories=Array.from({length:16},(_,id)=>({
  id,owner:id<14?1:0,neighbors:id===0?[1]:[id-1,Math.min(15,id+1)],
  point:{x:200+id*300,y:1000},income:25
 }));
 // HQ's physical sector is ALREADY held, while unrelated Bastions
 // remain blue. This reproduces the old mission-reset bug precisely.
 const hq={id:222,x:4700,y:1200,territory:0,hp:1200,
  owner:0,kind:'headquarters'};
 const g={time:235,world:{mapVersion:26},territories,units:[],
  memories:[[],known?[hq]:[]],canSee:()=>false,
  income:()=>200,credits:[500,1800]};
 const context={
  strategy:'unknown',force:[],losses:[],fronts:[],
  intelligent:false,bastionControl:false,breakthrough:true,
  // Neutral Bastions have legal full routes, while HQ requires a
  // physically verified partial mountain-pass route.
  route:p=>Math.abs(p.x-hq.x)<1?undefined:{length:550,risk:0},
  routeFallback:p=>Math.abs(p.x-hq.x)<1?{length:2800,risk:3}:undefined
 };
 return {g,hq,context};
}
test('KI43: an authorized real HQ siege persists over repeated 3s macro planning pulses',()=>{
 const {g,hq,context}=stagedScenario(true),s=newCampaign(),origin={x:1000,y:1600};
 const first=chooseMission(g,s,origin,context);
 assert.equal(first?.kind,'structure');
 assert.equal(first?.objective,hq.id);
 for(const time of [238,241,244,247,260]){
  g.time=time;
  assert.equal(chooseMission(g,s,origin,context),first,
   'must NOT restart the paid artillery assault or mission timer every 3s');
  assert.equal(first.since,235);
  assert.equal(s.aborted,0);
 }
 hq.hp-=160;g.time=266;
 assert.equal(chooseMission(g,s,origin,context),first);
 assert.equal(first.progressAt,266,'actual discovered HQ damage extends progress clock');
 assert.equal(first.hp,1040);
 g.time=269;
 assert.equal(chooseMission(g,s,origin,context),first);
 assert.equal(s.aborted,0);
});
test('KI43: no siege through fog or after earned dominance and authorization disappear',()=>{
 const a=stagedScenario(false),origin={x:1000,y:1600};
 assert.equal(chooseMission(a.g,newCampaign(),origin,a.context)?.kind,'capture');
 const b=stagedScenario(true),s=newCampaign();
 assert.equal(chooseMission(b.g,s,origin,b.context)?.kind,'structure');
 b.context.breakthrough=false;b.g.time=238;
 assert.equal(chooseMission(b.g,s,origin,b.context)?.kind,'capture',
  'withdraw the authorization when the combat screen is depleted');
 assert.equal(s.mission?.objective,null);
});
test('KI43: exact named-map gate; all four maps keep saved AI state and no free resources',()=>{
 for(const map of maps){
  const game=Simulation.campaign(map.seed,map.mapVersion,map.terrain,map.generatorVersion);
  assert.equal(game.tactical.hqBreakthroughMode,'calibrated');
  assert.equal(game.world.generatorVersion,map.generatorVersion);
  const before={credits:[...game.credits],units:game.units.length,
   world:JSON.stringify(game.world.generated.sites),
   saved:game.save()};
  assert.equal(before.units,game.units.length);
  assert.deepEqual(game.credits,before.credits);
  assert.equal(JSON.stringify(game.world.generated.sites),before.world);
  assert.equal(Simulation.load(before.saved).world.generatorVersion,map.generatorVersion);
  const old=Simulation.campaign(map.seed+1,map.mapVersion,map.terrain,4);
  assert.equal(old.tactical.ai37Mode,'coordinated',
   'a different seed cannot inherit one of the fixed-map offensive doctrines');
 }
 const src=readFileSync('src/reborn/tactical-ai.ts','utf8');
 assert.match(src,/selectDesertAIDoctrine/);
 assert.match(src,/hqBreakthroughMode==='calibrated'/);
 assert.match(src,/this\.ai36Enabled&&ai43OffensiveHqBreakthrough/);
 const benchmark=readFileSync('scripts/benchmark-sandforge-ai38-combat.mjs','utf8');
 assert.match(benchmark,/--variants/);
 assert.match(benchmark,/this\.tactical\.hqBreakthroughMode=variant==='calibrated'/);
});
