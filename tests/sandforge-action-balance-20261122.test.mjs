import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {RULES} from '../dist/src/reborn/config.js';
import {ACTION_BALANCE,initialActionCredits,constructionRate,productionRate,groundSpeedRate,actionBastionProbePolicy,actionBastionGoalScore,actionContestedBastionSafe,selectReachableOpeningSquad,actionOpeningHandoffSize,actionForwardRallyPolicy,actionHomeReservePolicy}
 from '../dist/src/reborn/action-balance.js';

test('new Action matches grant the same paid credit bonus to BOTH sides, only once',()=>{
 const g=new Simulation(2999,3),before=[...g.credits];
 assert.equal(g.balancePreset,'classic');
 assert.equal(g.configureBalancePreset('action'),true);
 assert.deepEqual(g.credits,before.map(initialActionCredits));
 assert.equal(g.configureBalancePreset('action'),false);
 assert.deepEqual(g.credits,before.map(initialActionCredits));
 assert.equal(g.balancePreset,'action');
 assert.equal(RULES.captureTime,8,'Bastion capturing must not be made instant');
});

test('Action modifiers speed up real unit movement but never unbalance aircraft',()=>{
 const classic=new Simulation(2999,3),action=new Simulation(2999,3);
 action.configureBalancePreset('action');
 const player=classic.units.find(u=>u.owner===0&&u.kind==='infantry');
 assert.ok(player);
 assert.equal(action.speed(player)/classic.speed(player),ACTION_BALANCE.groundSpeed);
 assert.equal(action.speed({...player,kind:'tank'})/classic.speed({...player,kind:'tank'}),ACTION_BALANCE.groundSpeed);
 assert.equal(action.speed({...player,kind:'scout'})/classic.speed({...player,kind:'scout'}),1);
 assert.equal(constructionRate('action'),1.25);
 assert.equal(constructionRate('classic'),1);
 assert.equal(productionRate('action','Infanterie'),1.30);
 assert.equal(productionRate('action','Fahrzeuge'),1.20);
 assert.equal(productionRate('action','Luftunterstützung'),1);
 assert.equal(groundSpeedRate('classic',false),1);
});

test('real paid HQ queues train a new engineer faster in Action with canonical queue durations',()=>{
 const classic=new Simulation(2999,3),action=new Simulation(2999,3);
 action.configureBalancePreset('action');
 const train=g=>{
  const hq=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
  assert.ok(hq);
  assert.equal(g.recruit(hq.id,'engineer'),true);
  assert.equal(hq.queue.length,1);
  assert.equal(hq.queue[0],7);
  return hq;
 };
 const ordinary=train(classic),rapid=train(action);
 for(let i=0;i<111;i++){classic.step(.05);action.step(.05);}
 assert.equal(rapid.queue.length,0,'Action engineer should complete around 5.4 seconds');
 assert.equal(ordinary.queue.length,1,'Classic engineer should require 7 seconds');
 assert.equal(classic.stats.factions[0].producedUnits,0);
 assert.equal(action.stats.factions[0].producedUnits,1);
});

test('Action mode survives save/load and classic historical saves remain unchanged',()=>{
 const g=new Simulation(1024,3);
 const old=g.save();
 assert.equal(old.balancePreset,undefined);
 assert.equal(Simulation.load(old).balancePreset,'classic');
 g.configureBalancePreset('action');
 for(let i=0;i<21;i++)g.step(.05);
 const saved=g.save();
 assert.equal(saved.balancePreset,'action');
 const restored=Simulation.load(saved);
 assert.equal(restored.balancePreset,'action');
 assert.deepEqual(restored.credits,g.credits,'save load must not grant the opening credit boost twice');
 assert.ok(restored.speed(restored.units.find(u=>u.owner===0))>0);
 assert.throws(()=>Simulation.load({...saved,balancePreset:'turbo'}),/beschädigt|Version|Ungültig/);
});

test('Action early Bastion probes are paid, time gated and respect observed home attacks',()=>{
 const base={preset:'action',mapVersion:24,time:80,available:4,blue:4,red:1,observedHomeThreat:false};
 assert.deepEqual(actionBastionProbePolicy(base),{slots:2,counter:true});
 assert.equal(actionBastionProbePolicy({...base,preset:'classic'}).slots,0);
 assert.equal(actionBastionProbePolicy({...base,time:5}).slots,0);
 assert.equal(actionBastionProbePolicy({...base,available:1}).slots,0);
 assert.equal(actionBastionProbePolicy({...base,observedHomeThreat:true}).slots,0);
 assert.deepEqual(actionBastionProbePolicy({...base,mapVersion:25,time:90,blue:1,red:1}),
  {slots:2,counter:false},'12-Bastion Action uses public ownership only');
 assert.equal(actionBastionProbePolicy({...base,time:250}).slots,0);
});

test('WebGL new-game menu enables Action without altering Classic deep links or 3D game speed',()=>{
 const menu=readFileSync('scripts/webgl-title-menu.js','utf8');
 const page=readFileSync('webgl-preview.html','utf8');
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 assert.match(page,/id="sf3d-balance-preset"/);
 assert.match(page,/value="action" selected/);
 assert.match(page,/value="classic"/);
 assert.match(menu,/params\.set\('balance','action'\)/);
 assert.match(menu,/balancePreset:data\.balancePreset==='action'/);
 assert.match(preview,/!session&&query\.get\('balance'\)==='action'/);
 assert.doesNotMatch(preview,/simulationSpeed\s*=\s*1\.20/);
});

test('Action hit feedback reuses bounded instancing and respects audio mixing',()=>{
 const vfx=readFileSync('scripts/webgl-combat-vfx.js','utf8');
 const audio=readFileSync('src/reborn/audio.ts','utf8');
 assert.match(vfx,/this\.game\.balancePreset==='action'/);
 assert.match(vfx,/Math\.min\(16,Math\.ceil\(response\.sparkCount\*1\.2\)\)/);
 assert.match(vfx,/Math\.min\(24,Math\.ceil\(n\*1\.17\)\)/);
 assert.match(vfx,/pool\.particles\.length>=pool\.max/,'Action VFX must retain instance caps');
 assert.match(audio,/g\.balancePreset==='action'/);
 assert.match(audio,/this\.lastExplosionAt/,'audio must retain spatial voice gate');
 assert.match(audio,/this\.effectsVolume/,'user volume controls still apply');
});

test('paid 9s Action recon scan reveals a chosen area but never a free persistent enemy map',()=>{
 const g=new Simulation(2999,3);
 const enemy=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 assert.ok(enemy);
 assert.equal(g.canSee(0,enemy),false);
 assert.equal(g.useActionReconScan(enemy),false,'Classic cannot use Action scan');
 g.configureBalancePreset('action');
 const before=g.credits[0];
 assert.equal(g.useActionReconScan(enemy),true,'Action with active HQ may pay for map scan');
 assert.equal(g.credits[0],before-ACTION_BALANCE.reconScanCredits);
 assert.equal(g.canSee(0,enemy),true,'visibility via same authoritative FOW, not cosmetic icon');
 assert.equal(g.useActionReconScan(enemy),false,'cooldown cannot be bypassed');
 assert.ok(g.actionScanReadyAt>=90);
 const saved=g.save();
 assert.equal(saved.balancePreset,'action');
 assert.ok(saved.actionScan&&saved.actionScan.until>saved.time);
 const load=Simulation.load(saved);
 assert.equal(load.balancePreset,'action');
 assert.equal(load.actionScanReadyAt,g.actionScanReadyAt);
 assert.equal(load.canSee(0,enemy),true);
 assert.equal(load.useActionReconScan(enemy),false,'save/reload must not reset cooldown');
 for(let i=0;i<190;i++)load.step(.05);
 assert.equal(load.actionScan?.until<=load.time,true);
 assert.equal(load.canSee(0,enemy),false,
  'after scan expires the target must be hidden again without real unit vision');
 assert.throws(()=>Simulation.load({...saved,actionScanReadyAt:9999}),
  /beschädigt|Version|Ungültig/,'tampered cooldown must not load');
});

test('scan target is the camera focus and action-only cooldown is visible on HUD',()=>{
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 const page=readFileSync('webgl-preview.html','utf8');
 assert.match(page,/id="action-scan"/);
 assert.match(preview,/game\.useActionReconScan\(focus\)/);
 assert.match(preview,/controls\.target\.x\+half/);
 assert.match(preview,/actionScanButton\.hidden=game\.balancePreset!=='action'/);
 assert.match(preview,/actionScanButton\.disabled=!ready/);
});

test('Action AI selects reachable, publicly contested frontiers before distant neutral sectors',()=>{
 const base={preset:'action',mapVersion:25,time:85,available:5,
  blue:3,red:2,frontierEnemy:1,observedHomeThreat:false};
 assert.deepEqual(actionBastionProbePolicy(base),{slots:2,counter:true});
 assert.equal(actionBastionProbePolicy({...base,frontierEnemy:0}).counter,false);
 assert.equal(actionBastionProbePolicy({...base,observedHomeThreat:true}).slots,0);
 assert.equal(actionBastionProbePolicy({...base,available:2}).counter,false);
 const closerNeutral={pathDistance:500,income:14,owner:-1,
  frontierRed:false,frontierBlue:false,counter:true};
 const exposedEnemy={...closerNeutral,pathDistance:700,owner:0,frontierRed:true};
 assert.ok(actionBastionGoalScore(exposedEnemy)<actionBastionGoalScore(closerNeutral),
  'send paid recapture soldiers to the public contact line, not far income');
 assert.ok(actionBastionGoalScore({...closerNeutral,frontierRed:true})<
  actionBastionGoalScore(closerNeutral),'near allied frontline should matter');
 assert.equal(actionBastionGoalScore({...closerNeutral,pathDistance:Infinity}),Infinity);
 const tactical=readFileSync('src/reborn/tactical-ai.ts','utf8');
 assert.match(tactical,/actionBastionGoalScore\(\{/);
 assert.match(tactical,/frontierEnemy:g\.territories\.filter/);
 assert.match(tactical,/g\.world\.path\(u,p,blockers,5\)/,
  'an A* validated approach is required before prioritizing a site');
});

test('Broken Empire plateau HQ builders work from the true collision-safe edge in both presets',()=>{
 for(const preset of ['classic','action']){
  const g=Simulation.campaign(2026,25,'rocky',10);
  g.configureBalancePreset(preset);
  const worker=g.units.find(u=>u.owner===0&&u.kind==='engineer'&&u.hp>0);
  assert.ok(worker,'paid engineer must exist');
  const site=g.headquartersCandidates(0).find(p=>!g.buildError(0,'headquarters',p));
  assert.ok(site,'physical plateau must have legal HQ foundation');
  const hq=g.build(0,'headquarters',site,[worker.id]);
  assert.ok(hq,'HQ build must spend ordinary credits and use a paid worker');
  for(let i=0;i<1000&&hq.buildRemaining>0;i++)g.step(.05);
  assert.equal(hq.buildRemaining,0,
   preset+' builder should finish HQ from the collision-safe approach by 50s');
  assert.equal(g.hasHeadquarters(0),true,'no free instant HQ or bypassed build rules');
  assert.equal(g.credits[0]>=0,true);
 }
});

test('Action early skirmish uses observed fighters and public frontlines, not unseen HQ or neutral land grabs',()=>{
 const input={preset:'action',mapVersion:26,time:85,available:6,
  blue:2,red:8,frontierEnemy:1,observedHomeThreat:false};
 assert.deepEqual(actionBastionProbePolicy(input),{slots:3,counter:true},
  'RED must contest adjacent public BLUE holdings even while ahead');
 assert.deepEqual(actionBastionProbePolicy({...input,available:9}),
  {slots:4,counter:true},'large paid army may open a second skirmish group');
 assert.deepEqual(actionBastionProbePolicy({...input,frontierEnemy:0}),
  {slots:3,counter:false},'no omniscient fog contacts');
 assert.equal(actionBastionProbePolicy({...input,preset:'classic'}).slots,0);
 assert.equal(actionBastionProbePolicy({...input,observedHomeThreat:true}).slots,0);
 const observed={preset:'action',counter:true,available:6,visibleEnemies:2,
  knownHq:false,knownTurret:false};
 assert.equal(actionContestedBastionSafe(observed),true);
 assert.equal(actionContestedBastionSafe({...observed,visibleEnemies:3}),false);
 assert.equal(actionContestedBastionSafe({...observed,knownTurret:true}),false);
 assert.equal(actionContestedBastionSafe({...observed,knownHq:true}),false);
 assert.equal(actionContestedBastionSafe({...observed,counter:false}),false);
 assert.equal(actionContestedBastionSafe({...observed,preset:'classic'}),false);
 assert.equal(actionContestedBastionSafe({...observed,visibleEnemies:0,preset:'classic'}),true);
 const tactical=readFileSync('src/reborn/tactical-ai.ts','utf8');
 assert.match(tactical,/selectReachableOpeningSquad\(assignable,2/,
  'front pivot validates the actual assignable two-unit squad');
 assert.match(tactical,/focusEnemyFront&&!s\.openingContests\.some/,
  'retain existing neutral missions unless a safe frontline pivot is worthwhile');
 assert.match(tactical,/frontierBias=g\.territories\.length>=16\?420:120/,
  'large maps may commit a paid squad to a reachable public frontline');
 assert.match(tactical,/neutralScore\+frontierBias/,
  'distant targets still require a competitive score to avoid repeated retargeting');
 assert.match(tactical,/!focusEnemyFront\|\|t\.owner===0/,
  'after choosing a public front do not immediately retarget the same pair to neutral');
 assert.match(tactical,/if\(maxAssigned-s\.openingContests\.length<count\)break/,
  'never push a new two-fighter mission past the save cap');
});

test('Action front squad skips blocked first soldiers, keeps feasible two-person counterattack',()=>{
 const paid=[{id:1},{id:2},{id:3},{id:4}];
 const reachable=new Set([2,4]);
 assert.deepEqual(selectReachableOpeningSquad(paid,2,u=>reachable.has(u.id)).map(u=>u.id),[2,4]);
 assert.deepEqual(selectReachableOpeningSquad(paid,3,u=>reachable.has(u.id)),[]);
 assert.deepEqual(selectReachableOpeningSquad(paid,1,u=>reachable.has(u.id)).map(u=>u.id),[2]);
 assert.deepEqual(selectReachableOpeningSquad(paid,0,()=>true),[]);
 const tactical=readFileSync('src/reborn/tactical-ai.ts','utf8');
 assert.match(tactical,/const assignable=ready\.filter/);
 assert.match(tactical,/const squad=actionOpening\s*\?selectReachableOpeningSquad\(free,count/);
 assert.match(tactical,/approachCache\.has\(key\)/,'A* probes reused only within one planning pulse');
 assert.match(tactical,/if\(!issued\)break/,'no infinite retry when command fails');
});

test('Action reuses paid scouts after capture without launching solo assaults',()=>{
 assert.equal(actionOpeningHandoffSize({counter:true,slots:2,free:2}),2);
 assert.equal(actionOpeningHandoffSize({counter:true,slots:2,free:1}),1);
 assert.equal(actionOpeningHandoffSize({counter:true,slots:1,free:3}),1);
 assert.equal(actionOpeningHandoffSize({counter:false,slots:2,free:2}),1);
 assert.equal(actionOpeningHandoffSize({counter:true,slots:0,free:2}),0);
 assert.equal(actionOpeningHandoffSize({counter:true,slots:2,free:0}),0);
 const ai=readFileSync('src/reborn/tactical-ai.ts','utf8');
 assert.match(ai,/const freshlySecured=actionOpening\?new Set/);
 assert.match(ai,/g\.territories\[e\.sectorId\]\?\.owner===1/);
 assert.match(ai,/freshlySecured\.has\(b\.id\)/,'reassign just-captured squad members first');
 assert.match(ai,/const soloNeutral=actionOpening&&counter&&count===1/);
 assert.match(ai,/!soloNeutral\|\|t\.owner===-1/,'single soldier must never attack occupied enemy Bastions');
 assert.match(ai,/const count=actionOpening\? actionOpeningHandoffSize/);
 assert.match(ai,/g\.world\.path\(u,p,blockers,5\)/,'all follow-on orders need actual A* paths');
 assert.match(ai,/if\(maxAssigned-s\.openingContests\.length<count\)break/);
});

test('Action forward rally is restricted to real safe neutral captures',()=>{
 const base={preset:'action',mapVersion:26,generatorVersion:10,
  time:90,missionKind:'capture',targetOwner:-1,phase:'gather',
  available:5,observedHomePressure:false,knownThreats:0};
 assert.equal(actionForwardRallyPolicy(base),true);
 assert.equal(actionForwardRallyPolicy({...base,preset:'classic'}),false);
 assert.equal(actionForwardRallyPolicy({...base,missionKind:'structure'}),false);
 assert.equal(actionForwardRallyPolicy({...base,targetOwner:0}),false);
 assert.equal(actionForwardRallyPolicy({...base,phase:'attack'}),false);
 assert.equal(actionForwardRallyPolicy({...base,phase:'defend'}),false);
 assert.equal(actionForwardRallyPolicy({...base,available:2}),true);
 assert.equal(actionForwardRallyPolicy({...base,available:1}),false);
 assert.equal(actionForwardRallyPolicy({...base,observedHomePressure:true}),false);
 assert.equal(actionForwardRallyPolicy({...base,knownThreats:1}),false);
 assert.equal(actionForwardRallyPolicy({...base,mapVersion:11}),false);
 const ai=readFileSync('src/reborn/tactical-ai.ts','utf8');
 assert.match(ai,/mission\.since!==this\.actionForwardRallyMissionSince/);
 assert.match(ai,/this\.actionForwardRallyRetryAt=g\.time\+18/);
 assert.match(ai,/reachableCluster\.length<2/);
 assert.match(ai,/distance\(leader,s\.rally\)<140/);
 assert.match(ai,/distance\(leader,mission\)\+80>=distance\(s\.rally,mission\)/);
 assert.match(ai,/g\.world\.path\(candidate,at,obstacles,5\)\.length>0/);
 assert.match(ai,/g\.world\.walkable\(candidate,obstacles,10\)/);
});

test('Action keeps a real HQ guard while freeing surplus opening reserves',()=>{
 const base={preset:'action',mapVersion:26,time:110,phase:'gather',
  missionKind:'capture',defendedTarget:false,fighters:10,
  normalReserve:4,homeMinimum:2,observedHomePressure:false,
  knownThreats:0,recentLosses:0,recentFailures:0};
 assert.equal(actionHomeReservePolicy(base),2);
 assert.equal(actionHomeReservePolicy({...base,defendedTarget:true}),3);
 assert.equal(actionHomeReservePolicy({...base,normalReserve:2}),2);
 assert.equal(actionHomeReservePolicy({...base,fighters:4,normalReserve:2,homeMinimum:0}),1);
 for(const testInput of [
  {preset:'classic'},{missionKind:'structure'},{phase:'attack'},
  {phase:'defend'},{observedHomePressure:true},{knownThreats:1},
  {recentLosses:1},{recentFailures:1},{time:20},{time:300},
  {mapVersion:11}
 ])assert.equal(actionHomeReservePolicy({...base,...testInput}),4,
  'guard quota must be preserved under '+JSON.stringify(testInput));
 assert.equal(actionHomeReservePolicy({...base,fighters:2}),2,
  'normal guard count remains physically capped by existing paid fighters');
 assert.equal(actionHomeReservePolicy({...base,fighters:2,
  normalReserve:2,homeMinimum:0}),1,
  'when only two genuine free fighters remain, one can scout a safe neutral Bastion while one guards home');
 assert.equal(actionHomeReservePolicy({...base,fighters:2,
  normalReserve:2,homeMinimum:0,observedHomePressure:true}),2,
  'an observed headquarters threat immediately restores both defenders');
 assert.equal(actionHomeReservePolicy({...base,fighters:2,
  normalReserve:2,homeMinimum:0,defendedTarget:true}),2,
  'do not strip a second guard for an enemy-held or fortified Bastion');
 const ai=readFileSync('src/reborn/tactical-ai.ts','utf8');
 assert.match(ai,/const actionReserve=actionHomeReservePolicy/);
 assert.match(ai,/\.slice\(0,actionReserve\)\.map\(u=>u\.id\)/);
 assert.match(ai,/homeGuardCapPulses\+\+/);
});
