import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {eliminationOutcome,hasFactionBuildings} from '../dist/src/reborn/match-outcome.js';
import {matchResultCopy} from '../scripts/webgl-match-result.js';

const actor=(owner,extra={})=>({owner,hp:100,...extra});
const site=(owner,extra={})=>({owner,hp:450,kind:'headquarters',buildRemaining:0,...extra});
function fresh(){
 const game=Simulation.campaign(2074,23,'dunes');
 game.aiClock=-1e6;
 game.tactical.plan=()=>{};
 return game;
}

test('last enemy building wins immediately even if red soldiers, tanks and boarded passengers survive',()=>{
 const blue=actor(0),enemy=[actor(1),actor(1,{carrier:17}),actor(1)];
 assert.equal(eliminationOutcome([blue,...enemy],[site(0),site(1)],[true,true]),'playing');
 assert.equal(eliminationOutcome([blue,...enemy],[site(0),site(1,{hp:0})],[true,true]),'victory');
 assert.equal(eliminationOutcome([blue,...enemy],[site(0)],[true,true]),'victory');
 assert.equal(hasFactionBuildings([site(1,{hp:0})],1),false);
 assert.equal(matchResultCopy('victory')?.title,'SIEG');
});

test('HQ-less campaign remains playable while both teams have never built anything',()=>{
 const game=fresh();
 assert.deepEqual(game.hadBuildings,[false,false]);
 assert.ok(game.units.some(u=>u.owner===0&&u.hp>0));
 assert.ok(game.units.some(u=>u.owner===1&&u.hp>0));
 game.step(.05);
 assert.equal(game.status,'playing');
 assert.equal(eliminationOutcome([actor(0),actor(1)],[],[false,false]),'playing');
 assert.equal(eliminationOutcome([actor(0),actor(1)],[],[true,false]),'defeat');
 assert.equal(eliminationOutcome([actor(0),actor(1)],[],[false,true]),'victory');
});

test('only a successful construction makes the team vulnerable to losing its final building',()=>{
 const game=fresh();
 game.credits[1]=10000;
 const engineer=game.units.find(u=>u.owner===1&&u.kind==='engineer');
 assert.ok(engineer);
 const point=game.headquartersCandidates(1).find(p=>game.buildError(1,'headquarters',p)===null);
 assert.ok(point,'red has a safe HQ construction location');
 const created=game.build(1,'headquarters',point,[engineer.id]);
 assert.ok(created,'actual AI construction must be accepted');
 assert.equal(game.hadBuildings[1],true);
 game.step(.05);
 assert.equal(game.status,'playing','active construction must count as a building');
 created.hp=0;
 game.step(.05);
 assert.equal(game.status,'victory','enemy still has living army, but lost all buildings');
 assert.ok(game.units.some(u=>u.owner===1&&u.hp>0));
});

test('symmetry: losing all own structures is defeat, simultaneous losses are not victory',()=>{
 const blue=actor(0),red=actor(1);
 assert.equal(eliminationOutcome([blue,red],[site(0),site(1,{hp:0})],[true,true]),'victory');
 assert.equal(eliminationOutcome([blue,red],[site(0,{hp:0}),site(1)],[true,true]),'defeat');
 assert.equal(eliminationOutcome([blue,red],[],[true,true]),'defeat');
 assert.equal(eliminationOutcome([blue,red],[site(0),site(1,{buildRemaining:60})],[true,true]),'playing');
 assert.equal(eliminationOutcome([blue,red],[site(0),site(1,{kind:'wall'})],[true,true]),'playing');
});

test('building history survives save/load; unfinished last-strike wins on restoration',()=>{
 const game=fresh();
 game.credits[0]=10000;
 const worker=game.units.find(u=>u.owner===0&&u.kind==='engineer');
 const point=game.headquartersCandidates(0).find(p=>game.buildError(0,'headquarters',p)===null);
 assert.ok(worker&&point);
 assert.ok(game.build(0,'headquarters',point,[worker.id]));
 // Enemy previously had a base and its last structure is now gone.
 game.hadBuildings[1]=true;
 game.step(.05);
 assert.equal(game.status,'victory');
 const saved=game.save();
 assert.deepEqual(saved.hadBuildings,[true,true]);
 const restored=Simulation.load(saved);
 assert.equal(restored.status,'victory');
 assert.deepEqual(restored.hadBuildings,[true,true]);
 const beforeLastTick={...saved,status:'playing'};
 assert.equal(Simulation.load(beforeLastTick).status,'victory');
 // Invalid/forged flag cannot slip past strict v2 validation.
 assert.throws(()=>Simulation.load({...saved,hadBuildings:[false,'yes']}),/beschädigt/);
});

test('older saves without history do not falsely end at startup',()=>{
 const game=fresh();
 const saved=game.save();
 delete saved.hadBuildings;
 assert.equal(Simulation.load(saved).status,'playing');
 const old={...saved,status:'victory'};
 assert.equal(Simulation.load(old).status,'playing');
});

test('legacy maps start with existing HQ history, old eliminated HQ stubs cannot block victory',()=>{
 const old=new Simulation(2074,11);
 assert.deepEqual(old.hadBuildings,[true,true]);
 old.bases.filter(b=>b.owner===1).forEach(b=>b.hp=0);
 old.step(.05);
 assert.equal(old.status,'victory');
 const saved=old.save();
 delete saved.hadBuildings;
 const loaded=Simulation.load(saved);
 assert.equal(loaded.status,'victory','old HQ records prove historical enemy construction');
});

test('legacy save migration can infer historical structures from paid production',()=>{
 const game=fresh(),saved=game.save();
 saved.stats.factions[1].producedUnits=1;
 delete saved.hadBuildings;
 const loaded=Simulation.load(saved);
 assert.equal(loaded.hadBuildings[1],true);
 assert.equal(loaded.status,'victory');
});
