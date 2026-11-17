import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {chooseMission,newCampaign} from '../dist/src/reborn/campaign-commander.js';
import {distance} from '../dist/src/reborn/config.js';
import {readFileSync} from 'node:fs';

const scenario=()=>{
 const g=new Simulation(2026,4);
 const redHQ=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 const blueHQ=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 assert.ok(redHQ&&blueHQ);
 // Inject only observed intelligence, not omniscient location.
 g.memories[1].push({id:blueHQ.id,kind:blueHQ.kind,owner:0,
  x:blueHQ.x,y:blueHQ.y,hp:blueHQ.hp,territory:blueHQ.territory});
 const redHQSector=g.territories[redHQ.territory];
 return {g,redHQ,blueHQ,redHQSector};
};

test('phase 1: public unheld Bastions always precede a known enemy HQ rush',()=>{
 const {g,redHQ,blueHQ}=scenario();
 const state=newCampaign();
 const goal=chooseMission(g,state,redHQ);
 assert.ok(goal);
 assert.equal(goal.kind,'capture','the first objective must be a Bastion');
 assert.equal(goal.objective,null,'do not attack the enemy HQ while other Bastions are exposed');
 assert.notEqual(g.territories[goal.sector].owner,1);
 assert.equal(blueHQ.owner,0);
});

test('phase 1: a living HQ in the selected Bastion is a legal tactical blocker',()=>{
 const {g,redHQ,blueHQ}=scenario();
 const t=g.territories[blueHQ.territory];
 const commander=newCampaign();
 commander.mission={kind:'capture',sector:t.id,objective:null,
  x:t.point.x,y:t.point.y,hp:0,distance:distance(redHQ,t.point),
  since:g.time,progressAt:g.time};
 const target=chooseMission(g,commander,redHQ);
 assert.equal(target?.kind,'structure');
 assert.equal(target?.objective,blueHQ.id,
  'HQ destruction is permitted only when physically blocking Bastion conquest');
 assert.equal(target?.sector,t.id);
});

test('phase 1: free adjacent Bastion outranks a visible turret-blocked Bastion',()=>{
 const {g,redHQ,redHQSector}=scenario();
 const neighbors=redHQSector.neighbors.map(id=>g.territories[id]).filter(t=>t.owner===-1);
 assert.ok(neighbors.length>=2);
 const defended=neighbors[0],free=neighbors[1];
 const turret={id:88001,owner:0,kind:'turret',hp:650,
  x:defended.point.x,y:defended.point.y,territory:defended.id};
 g.memories[1].push(turret);
 const goal=chooseMission(g,newCampaign(),redHQ);
 assert.equal(goal?.kind,'capture');
 assert.equal(goal?.sector,free.id,
  'select the unfortified Bastion before knowingly entering a guarded capture zone');
});

test('phase 1: if all adjacent Bastions are defended, attack only their known blocker',()=>{
 const {g,redHQ,redHQSector}=scenario();
 const adjacent=redHQSector.neighbors.map(id=>g.territories[id]).filter(t=>t.owner===-1);
 assert.ok(adjacent.length>=2);
 for(const [i,t] of adjacent.entries())g.memories[1].push({
  id:88002+i,owner:0,kind:'turret',hp:650,
  x:t.point.x,y:t.point.y,territory:t.id
 });
 const goal=chooseMission(g,newCampaign(),redHQ);
 assert.equal(goal?.kind,'structure');
 assert.ok(g.memories[1].some(m=>m.id===goal.objective&&m.kind==='turret'));
 assert.notEqual(g.territories[goal.sector].owner,1);
});

test('phase 2: after all Bastions are secure, destroy remaining known enemies',()=>{
 const {g,redHQ,blueHQ}=scenario();
 for(const t of g.territories)t.owner=1;
 const commander=newCampaign();
 const goal=chooseMission(g,commander,redHQ);
 assert.equal(goal?.kind,'structure');
 assert.equal(goal?.objective,blueHQ.id);
});

test('recapture: a lost Bastion immediately outranks unrelated enemy industry',()=>{
 const {g,redHQ,blueHQ}=scenario();
 for(const t of g.territories)t.owner=1;
 const victim=g.territories.find(t=>t.id!==blueHQ.territory&&t.id!==redHQ.territory);
 assert.ok(victim);
 victim.owner=0;
 const commander=newCampaign();
 const goal=chooseMission(g,commander,redHQ);
 assert.equal(goal?.kind,'capture');
 assert.equal(goal?.sector,victim.id);
 assert.equal(goal?.objective,null);
});

test('phase 1: stale HQ attack is dropped if the Bastion it targeted was secured',()=>{
 const {g,redHQ,blueHQ}=scenario();
 const commander=newCampaign();
 const t=g.territories[blueHQ.territory];t.owner=1;
 commander.mission={kind:'structure',sector:t.id,objective:blueHQ.id,
  x:blueHQ.x,y:blueHQ.y,hp:blueHQ.hp,distance:distance(redHQ,blueHQ),
  since:0,progressAt:0};
 const goal=chooseMission(g,commander,redHQ);
 assert.equal(goal?.kind,'capture');
 assert.notEqual(goal?.sector,t.id);
});

test('paid frontier guard: HQ reserve is protected, one soldier may protect an exposed Bastion',()=>{
 const source=readFileSync('src/reborn/tactical-ai.ts','utf8');
 assert.match(source,/const border=g\.territories\.filter\(t=>t\.owner===1&&/);
 assert.match(source,/const fort=i===1&&guards\.length>=2&&border\?border:null/);
 assert.match(source,/const radius=fort\?68:/);
 assert.match(source,/const base=fort\?\.point\?\?protectedBases/);
 assert.match(source,/if\(u\.defendUntil>g\.time\)continue/,
  'active combat cannot be overridden by a scripted garrison order');
 assert.match(source,/ownedBastions\.some\(t=>distance\(u,t\.point\)<260\)/,
  'a visible intruder near a captured Bastion triggers local defense too');
 assert.match(source,/\.\.\.g\.territories\.filter\(t=>t\.owner===1\)\.map\(t=>t\.point\)/,
  'defensive priority accounts for actual owned Bastion positions');
});
