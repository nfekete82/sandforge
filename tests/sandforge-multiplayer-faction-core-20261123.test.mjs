import test from 'node:test';
import assert from 'node:assert/strict';
import {planMultiplayerSetup} from '../dist/src/reborn/multiplayer-setup.js';
import {
 factionHostile,factionFriendly,sectorCaptureAllowed,
 enemyTargetAllowed,observedHostiles,publicTeamTerritoryCounts,
 resolveTeamCapturePresence
} from '../dist/src/reborn/multiplayer-faction-rules.js';
import {
 perPlayerSlots,createFactionRuntimeSlots,spendFactionCredits,grantFactionIncome
} from '../dist/src/reborn/multiplayer-faction-runtime.js';
import {
 eliminationOutcome,resolveTeamElimination,hasFactionAssets
} from '../dist/src/reborn/match-outcome.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {canCaptureSector,captureSeconds} from '../dist/src/reborn/territory-warfare.js';

const ffa=(n=4)=>planMultiplayerSetup({
 version:24,seed:4102,playerCount:n
});
const teams=()=>planMultiplayerSetup({
 version:26,seed:4102,playerCount:4,mode:'two-versus-two'
});
const players=s=>s.slots.map(({player,team})=>({player,team}));
const unit=(owner,hp=100)=>({owner,hp});
const base=(owner,hp=900)=>({owner,hp,buildRemaining:0});
const outcome=(setup,units,bases=[],history=setup.slots.map(()=>false))=>
 resolveTeamElimination(units,bases,players(setup),history,0);

test('FFA has three independent hostile AI players, no hidden alliances',()=>{
 const setup=ffa(4);
 assert.deepEqual(setup.slots.map(s=>s.controller),['human','ai','ai','ai']);
 for(let i=0;i<4;i++)for(let j=0;j<4;j++){
  assert.equal(factionHostile(setup,i,j),i!==j);
  assert.equal(factionFriendly(setup,i,j),i===j);
  assert.equal(sectorCaptureAllowed(setup,i,j),i!==j);
 }
 assert.equal(sectorCaptureAllowed(setup,0,-1),true);
 assert.throws(()=>factionHostile(setup,0,5),/Unknown match participant/);
});

test('2v2 allies never become attack targets or capture targets',()=>{
 const setup=teams();
 assert.deepEqual(setup.slots.map(p=>p.team),[0,0,1,1]);
 for(const p of [0,1]){
  assert.equal(factionHostile(setup,p,1-p),false);
  assert.equal(sectorCaptureAllowed(setup,p,1-p),false);
  assert.equal(enemyTargetAllowed(setup,p,unit(1-p)),false);
  for(const foe of [2,3]){
   assert.equal(factionHostile(setup,p,foe),true);
   assert.equal(sectorCaptureAllowed(setup,p,foe),true);
   assert.equal(enemyTargetAllowed(setup,p,unit(foe)),true);
  }
 }
 assert.equal(enemyTargetAllowed(setup,0,unit(2,0)),false);
});

test('AI threat evaluation excludes friendly, dead and UNOBSERVED opponents',()=>{
 const setup=ffa();
 const assets=[{owner:1,hp:100,visible:true},
  {owner:2,hp:100,visible:false},
  {owner:3,hp:0,visible:true},
  {owner:0,hp:100,visible:true}];
 assert.deepEqual(observedHostiles(setup,0,assets,a=>a.visible),[assets[0]]);
 const ally=teams();
 assert.deepEqual(observedHostiles(ally,0,assets,a=>a.visible),[]);
});

test('public Bastion income control reflects each separate team',()=>{
 const setup=teams();
 const counts=publicTeamTerritoryCounts(setup,[-1,0,0,1,2,2,3,-1]);
 assert.equal(counts.get(0),3);
 assert.equal(counts.get(1),3);
 const independent=publicTeamTerritoryCounts(ffa(),[-1,0,1,2,3,3]);
 assert.deepEqual([...independent.entries()],[[0,1],[1,1],[2,1],[3,2]]);
});

test('four participants never share credits, technology, fog, memory or bot timers',()=>{
 const setup=teams();
 const states=createFactionRuntimeSlots(setup,64,950);
 assert.equal(states.length,4);
 assert.deepEqual(states.map(x=>x.credits),[950,950,950,950]);
 for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){
  for(const field of ['visible','explored','memories','research'])
   assert.notEqual(states[i][field],states[j][field],field+' must be private');
  assert.notEqual(states[i].research.completed,states[j].research.completed);
 }
 assert.equal(spendFactionCredits(states,0,200),true);
 assert.equal(spendFactionCredits(states,0,900),false);
 grantFactionIncome(states,3,100);
 states[1].visible[4]=1;
 states[2].explored[4]=1;
 states[3].research.completed.push('armor1');
 states[3].memories.push({id:9,owner:0,x:15,y:30,seenAt:10});
 states[3].aiClock=24;
 assert.deepEqual(states.map(x=>x.credits),[750,950,950,1050]);
 assert.deepEqual(states.map(x=>x.visible[4]),[0,1,0,0]);
 assert.deepEqual(states.map(x=>x.explored[4]),[0,0,1,0]);
 assert.deepEqual(states.map(x=>x.research.completed),[[],[],[],['armor1']]);
 assert.deepEqual(states.map(x=>x.memories.length),[0,0,0,1]);
 assert.deepEqual(states.map(x=>x.aiClock),[0,0,0,24]);
 assert.throws(()=>spendFactionCredits(states,0,-1),/credit/);
 assert.throws(()=>grantFactionIncome(states,2,-20),/income/);
 assert.throws(()=>createFactionRuntimeSlots(setup,0),/Fog buffer/);
 assert.throws(()=>perPlayerSlots(5,()=>null),/2-4/);
});

test('FFA only ends when the last rival team is actually eliminated',()=>{
 const setup=ffa();
 const live=[unit(0),unit(1),unit(2),unit(3)];
 assert.deepEqual(outcome(setup,live).livingTeams,[0,1,2,3]);
 assert.equal(outcome(setup,live).outcome,'playing');
 assert.deepEqual(outcome(setup,live.slice(0,3)).eliminatedPlayers,[3]);
 assert.equal(outcome(setup,live.slice(0,3)).outcome,'playing');
 assert.equal(outcome(setup,live.slice(0,2)).outcome,'playing');
 const win=outcome(setup,[unit(0)]);
 assert.equal(win.winningTeam,0);
 assert.equal(win.outcome,'victory');
 const lose=outcome(setup,[unit(1),unit(2)]);
 assert.equal(lose.outcome,'defeat');
 assert.equal(lose.winningTeam,null);
});

test('2v2 team survives death of one player, wins only after BOTH opponents die',()=>{
 const setup=teams();
 const first=outcome(setup,[unit(0),unit(1),unit(2),unit(3)]);
 assert.equal(first.outcome,'playing');
 const allyLost=outcome(setup,[unit(0),unit(2),unit(3)]);
 assert.equal(allyLost.outcome,'playing');
 const humanLost=outcome(setup,[unit(1),unit(2),unit(3)]);
 assert.equal(humanLost.outcome,'playing');
 assert.equal(humanLost.localPlayerEliminated,true);
 const soloEnemyLost=outcome(setup,[unit(1),unit(3)]);
 assert.equal(soloEnemyLost.outcome,'playing');
 const allyWins=outcome(setup,[unit(1)]);
 assert.equal(allyWins.outcome,'victory');
 assert.equal(allyWins.winningTeam,0);
 const defeat=outcome(setup,[unit(2),unit(3)]);
 assert.equal(defeat.outcome,'defeat');
 assert.equal(defeat.winningTeam,1);
});

test('HQ-less starts, boarded troops, building history and double-KO',()=>{
 const setup=ffa(3);
 const alive=[unit(0),unit(1),unit(2)];
 assert.equal(outcome(setup,alive,[]).outcome,'playing',
  'living army without HQ must not be defeated at time 0');
 assert.equal(outcome(setup,[unit(0),unit(1),unit(2)],[base(0)],[
  true,true,false
 ]).outcome,'playing');
 const established=outcome(setup,alive,[base(0),base(1)],[
  true,true,true
 ]);
 assert.deepEqual(established.eliminatedPlayers,[2],
  'destroyed last structure defeats that faction despite living soldiers');
 const boarded=[{...unit(0),carrier:900},{...unit(1),carrier:901}];
 assert.equal(hasFactionAssets(boarded,[],0),true);
 assert.equal(outcome(setup,boarded,[base(1)],[
  true,true,false
 ]).outcome,'defeat',
  'boarded infantry cannot prolong a faction with destroyed bases');
 const ko=outcome(setup,[],[],[true,true,true]);
 assert.equal(ko.winningTeam,null);
 assert.equal(ko.outcome,'defeat');
});

test('legacy 1v1 outcome semantics are EXACTLY preserved',()=>{
 const legacy=(units,bases,history)=>{
  const assets=owner=>units.some(u=>u.owner===owner&&u.hp>0)||
   bases.some(b=>b.owner===owner&&b.hp>0);
  const buildings=owner=>bases.some(b=>b.owner===owner&&b.hp>0);
  const dead=owner=>!assets(owner)||(history[owner]&&!buildings(owner));
  return dead(0)?'defeat':dead(1)?'victory':'playing';
 };
 for(const aliveUnits of [0,1,2,3])for(const aliveBases of [0,1,2,3])
 for(const history of [[false,false],[true,false],[false,true],[true,true]]){
  const units=[0,1].filter(id=>(aliveUnits&(1<<id))!==0).map(id=>unit(id));
  const bases=[0,1].filter(id=>(aliveBases&(1<<id))!==0).map(id=>base(id));
  assert.equal(eliminationOutcome(units,bases,history),
   legacy(units,bases,history));
 }
});

test('live 1v1 Simulation uses separate buffers and remains playable',()=>{
 const game=Simulation.campaign(4102,24,'oasis',4);
 assert.equal(game.visible.length,2);
 assert.equal(game.explored.length,2);
 assert.equal(game.memories.length,2);
 assert.notEqual(game.visible[0],game.visible[1]);
 assert.notEqual(game.explored[0],game.explored[1]);
 assert.notEqual(game.memories[0],game.memories[1]);
 for(let i=0;i<20;i++)game.step(.05);
 assert.equal(game.status,'playing');
});

test('authoritative Bastion ring accepts allied soldiers, rejects hostile contests',()=>{
 const setup=teams();
 const teamOf=id=>setup.slots[id].team;
 const fighter=(owner,id)=>({owner,hp:100,kind:'infantry',id});
 const allies=[fighter(0,3),fighter(1,4)];
 assert.deepEqual(resolveTeamCapturePresence(allies,teamOf),
  {claimant:0,contested:false});
 assert.deepEqual(resolveTeamCapturePresence([...allies].reverse(),teamOf),
  {claimant:0,contested:false},'claimant must not depend on iteration order');
 assert.deepEqual(resolveTeamCapturePresence([fighter(1,4)],teamOf),
  {claimant:1,contested:false});
 assert.deepEqual(resolveTeamCapturePresence([fighter(0,3),fighter(2,4)],teamOf),
  {claimant:-1,contested:true});
 assert.deepEqual(resolveTeamCapturePresence([fighter(0,3),fighter(1,4),fighter(3,5)],teamOf),
  {claimant:-1,contested:true});
 assert.deepEqual(resolveTeamCapturePresence([
  {...fighter(3,5),hp:0},{...fighter(2,4),kind:'drone'},
  {...fighter(1,6),carrier:44},fighter(0,3)],teamOf),
  {claimant:0,contested:false});
 assert.deepEqual(resolveTeamCapturePresence([],teamOf),
  {claimant:-1,contested:false});
 const legacy=id=>id;
 assert.deepEqual(resolveTeamCapturePresence([fighter(0,3),fighter(1,4)],legacy),
  {claimant:-1,contested:true},
  'classic 1v1 must keep the same blue/red contest rule');
});

test('team-safe sector legality and generalized 4-way recapture duration',()=>{
 const teams2=teams(),teamOf=id=>teams2.slots[id].team;
 const neutral={id:0,owner:-1,point:{x:0,y:0},neighbors:[],income:15};
 const allied={...neutral,owner:1};
 const enemy={...neutral,owner:3};
 assert.equal(canCaptureSector([],neutral,0,24,teamOf),true);
 assert.equal(canCaptureSector([],allied,0,24,teamOf),false);
 assert.equal(canCaptureSector([],enemy,0,24,teamOf),true);
 assert.equal(canCaptureSector([],enemy,3,24,teamOf),false);
 assert.equal(canCaptureSector([],enemy,5,24,teamOf),false);
 assert.equal(canCaptureSector([],enemy,-1,24,teamOf),false);
 // The 4-way fast recapture uses the ACTUAL territory owner and physical
 // defense rather than arithmetic '1-attacker' that only works in 1v1.
 assert.equal(captureSeconds({
  version:24,territory:enemy,attacker:0,units:[],bases:[]
 }),5);
 assert.equal(captureSeconds({
  version:24,territory:enemy,attacker:0,
  units:[{owner:3,hp:100,kind:'infantry',x:40,y:0}],bases:[]
 }),8);
 assert.equal(captureSeconds({
  version:24,territory:neutral,attacker:0,units:[],bases:[]
 }),8);
});
