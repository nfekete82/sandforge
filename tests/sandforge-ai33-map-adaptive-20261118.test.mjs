import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {newBattle} from '../dist/src/reborn/battle-response.js';
import {mapRaidReady,mapRaidRouteReady,mapFrontierPosts} from '../dist/src/reborn/ai33-map-doctrine.js';
import {parseOptions} from '../scripts/benchmark-reborn-ai.mjs';

const shape={mapVersion:24,time:110,phase:'attack',fighters:12,main:6,
 eligible:3,homeGuards:3,homePressure:false,recentLosses:0,recentFailures:0,emergency:false};

test('3.3 concentrates eight-Bastion armies instead of splitting the opening',()=>{
 assert.equal(mapRaidReady(shape),false);
 assert.equal(mapRaidReady({...shape,time:200,fighters:15,main:9}),true);
 assert.equal(mapRaidReady({...shape,time:200,fighters:15,main:9,homePressure:true}),false);
 assert.equal(mapRaidReady({...shape,time:200,fighters:15,main:9,recentLosses:1}),false);
 assert.equal(mapRaidReady({...shape,time:200,fighters:15,main:9,eligible:1}),false);
 assert.equal(mapRaidRouteReady(24,1200,4),true);
 assert.equal(mapRaidRouteReady(24,1800,4),false);
 assert.equal(mapRaidRouteReady(24,1100,7),false);
 assert.equal(mapFrontierPosts(24,4,3,2),0);
 assert.equal(mapFrontierPosts(24,5,3,2),1);
});

test('3.3 leaves twelve-Bastion AI 3.2 decisions byte-for-byte equivalent',()=>{
 assert.equal(mapRaidReady({...shape,mapVersion:25}),true);
 assert.equal(mapRaidReady({...shape,mapVersion:25,homePressure:true}),true);
 assert.equal(mapRaidRouteReady(25,2500,7.9),true);
 for(const guards of [0,2,4,8])assert.equal(mapFrontierPosts(25,guards,5,3),3);
});

test('3.3 large-map second front waits for strength and demands reachable low-risk routes',()=>{
 const large={...shape,mapVersion:26,time:160};
 assert.equal(mapRaidReady(large),false);
 assert.equal(mapRaidReady({...large,fighters:16,main:9}),true);
 assert.equal(mapRaidReady({...large,fighters:16,main:9,recentFailures:1}),false);
 assert.equal(mapRaidReady({...large,fighters:16,main:9,homeGuards:2}),false);
 assert.equal(mapRaidRouteReady(26,1800,5),true);
 assert.equal(mapRaidRouteReady(26,1800,6),false);
 assert.equal(mapRaidRouteReady(26,2200,4),false);
 assert.equal(mapFrontierPosts(26,4,5,2),1);
 assert.equal(mapFrontierPosts(26,6,5,2),2);
 assert.equal(mapFrontierPosts(26,3,5,2),0);
});

test('benchmark ablation rejects unsupported mode and records explicitly selected AI policy',()=>{
 assert.equal(parseOptions(['--ai33','off']).ai33,'off');
 assert.equal(parseOptions(['--ai33','adaptive']).ai33,'adaptive');
 assert.throws(()=>parseOptions(['--ai33','boosted']),/Invalid benchmark options/);
});

function army(version,mode){
 const g=new Simulation(2601,version);
 g.tactical.ai33Mode=mode;g.tactical.mode='director';
 const hq=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 assert.ok(hq);
 g.world.blocked.fill(0);g.world.opaque.fill(0);g.world.components.fill(0);
 g.time=110;g.aiClock=1e8;g.tactical.state.phase='attack';
 g.tactical.state.battle=newBattle();g.tactical.state.losses=[];
 const members=[];
 for(let i=0;i<12;i++)members.push(g.spawn(1,{
  x:hq.x+175+i*23,y:hq.y+120+i*11},i>=9?'rover':'infantry'));
 g.tactical.state.group=members.slice(0,6).map(u=>u.id);
 const t=g.territories.find(t=>t.owner===-1&&t.neighbors.some(id=>g.territories[id].owner===1));
 assert.ok(t);
 return {g,members,home:hq,sector:t};
}

test('real 8-Bastion integration: off = 3.2 raid, adaptive = 3.3 committed main front',()=>{
 const old=army(24,'off'),next=army(24,'adaptive');
 const a=old.g.tactical.secondaryPressure(old.members,{sector:old.sector.id},old.home);
 const b=next.g.tactical.secondaryPressure(next.members,{sector:next.sector.id},next.home);
 assert.equal(a.size,2,'the original 3.2 split has not been silently altered');
 assert.equal(b.size,0,'the new 3.3 opening holds the paid force together');
 assert.deepEqual(next.g.credits,old.g.credits,'no currency or economic handicap');
 assert.equal(next.g.units.length,old.g.units.length,'same physically paid army');
});

test('real 12-Bastion integration: both modes issue the same secondary orders',()=>{
 const old=army(25,'off'),next=army(25,'adaptive');
 const a=old.g.tactical.secondaryPressure(old.members,{sector:old.sector.id},old.home);
 const b=next.g.tactical.secondaryPressure(next.members,{sector:next.sector.id},next.home);
 assert.deepEqual([...a].sort((a,b)=>a-b),[...b].sort((a,b)=>a-b));
 assert.deepEqual(next.g.units.map(u=>u.orders),old.g.units.map(u=>u.orders));
});

test('real 16-Bastion integration: preserve red garrison instead of prematurely detaching',()=>{
 const old=army(26,'off'),next=army(26,'adaptive');
 const a=old.g.tactical.secondaryPressure(old.members,{sector:old.sector.id},old.home);
 const b=next.g.tactical.secondaryPressure(next.members,{sector:next.sector.id},next.home);
 assert.equal(a.size,2);
 assert.equal(b.size,0);
 assert.equal(next.g.credits[1],old.g.credits[1]);
});
