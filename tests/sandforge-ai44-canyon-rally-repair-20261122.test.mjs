import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {
 ai44RallyRepairEnabled,ai41RallyMissionPermitsRescue,
 ai40ShouldAttemptRecovery,ai40ClusterRallyRecovery
} from '../dist/src/reborn/ai40-rally-recovery.js';

test('exact v10 Last Stronghold may recover an unpathable rally even if fortifications disabled',()=>{
 const g=new Simulation(314159,26,false,false,'mixed',10);
 assert.equal(g.world.generated.landscapeKind,'serpentine-canyon');
 assert.equal(g.tactical.ai37Mode,'off','map should keep original calibration');
 assert.equal(ai44RallyRepairEnabled({
  seed:g.seed,mapVersion:g.world.mapVersion,
  generatorVersion:g.world.generatorVersion,
  landscapeKind:g.world.generated.landscapeKind,
  fortificationMode:g.tactical.ai37Mode
 }),true,'physical route recovery is not a defensive upgrade');
 assert.equal(g.tactical.ai37Mode,'off',
  'must NOT change economy, production, bunker or fortification doctrine');
});

test('historical saves, other seeds and unrelated maps remain unaffected',()=>{
 const input={seed:314159,mapVersion:26,generatorVersion:10,
  landscapeKind:'serpentine-canyon',fortificationMode:'off'};
 for(const other of [
  {generatorVersion:5},{generatorVersion:9},{seed:2026},
  {mapVersion:24},{landscapeKind:'diagonal-ridge'}
 ]){
  assert.equal(ai44RallyRepairEnabled({...input,...other}),false,
   JSON.stringify(other));
 }
 assert.equal(ai44RallyRepairEnabled({
  ...input,seed:2026,fortificationMode:'coordinated'
 }),true,'existing enabled AI3.7 must stay enabled');
});

test('no extra rally shifting during HQ siege, a home attack, or healthy marching',()=>{
 assert.equal(ai41RallyMissionPermitsRescue({
  kind:'structure',homePressure:false,time:280,notBefore:40
 }),false);
 assert.equal(ai41RallyMissionPermitsRescue({
  kind:'capture',homePressure:true,time:280,notBefore:40
 }),false);
 assert.equal(ai40ShouldAttemptRecovery({
  fighters:12,blockedOrders:0,elapsed:400,readyAtRally:0
 }),false);
 assert.equal(ai40ShouldAttemptRecovery({
  fighters:12,blockedOrders:6,elapsed:130,readyAtRally:4
 }),false);
 const troops=Array.from({length:12},(_,i)=>({
  id:i,kind:i===0?'artillery':'infantry',hp:100,
  x:1200+(i%4)*25,y:1300+Math.floor(i/4)*30
 }));
 const repaired=ai40ClusterRallyRecovery({
  units:troops,oldRally:{x:3900,y:3900},
  mission:{x:3700,y:3700},
  stalledSeconds:135,trappedMoveOrders:8,
  siegeRequired:false,viable:p=>p.x<2000&&p.y<2000
 });
 assert.ok(repaired);
 assert.ok(repaired.x<2000);
 assert.equal(ai40ClusterRallyRecovery({
  units:troops,oldRally:{x:3900,y:3900},mission:{x:3700,y:3700},
  stalledSeconds:135,trappedMoveOrders:8,
  siegeRequired:false,viable:()=>false
 }),undefined,'never choose an unsafe cliff or known gun site');
});

test('runtime wire connects the doctrine to real blocked-route gate and trace',()=>{
 const src=readFileSync('src/reborn/tactical-ai.ts','utf8');
 assert.match(src,/const ai44CanRepairRally=ai44RallyRepairEnabled/);
 assert.match(src,/ai44CanRepairRally&&s\.phase==='gather'/);
 assert.match(src,/!ai44CanRepairRally\?\['rally-repair-doctrine-off'\]/);
 assert.match(src,/ai40ShouldAttemptRecovery/);
 assert.match(src,/ai40ClusterRallyRecovery/);
});
