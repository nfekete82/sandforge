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
 // At ~550 units between Bastions, a tower on the first capture circle
 // also covers the second one! Place this observed turret farther back so
 // the second target really is out of its 660-unit defended-area threshold.
 const separation=distance(defended.point,free.point);
 const shift=Math.max(70,710-separation);
 const turret={id:88001,owner:0,kind:'turret',hp:650,
  x:defended.point.x+(defended.point.x-free.point.x)/separation*shift,
  y:defended.point.y+(defended.point.y-free.point.y)/separation*shift,
  territory:defended.id};
 assert.ok(distance(turret,free.point)>660,'free Bastion must actually be outside gun cover');
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

test('paid frontier guard: retain home reserve and post only reachable paid defenders',async()=>{
 const {frontierGuardPosts}=await import('../dist/src/reborn/ai32-doctrine.js');
 const {mapFrontierPosts}=await import('../dist/src/reborn/ai33-map-doctrine.js');
 assert.equal(frontierGuardPosts(1,4),0,'one sentry must stay at the base');
 assert.equal(frontierGuardPosts(2,4),1,'two guards may split only one frontier post');
 assert.equal(frontierGuardPosts(4,4),2,'four guards may cover two exposed Bastions');
 assert.equal(mapFrontierPosts(24,4,4,2),0,'8-Bastion KI 3.3 concentrates small reserves at home');
 assert.equal(mapFrontierPosts(24,5,4,2),1,'8-Bastion KI 3.3 posts only one of five guards');
 assert.equal(mapFrontierPosts(25,4,4,2),2,'12-Bastion version retains KI 3.2');
 assert.equal(mapFrontierPosts(26,6,4,2),2,'16-Bastion version protects HQ with four guards');
 const source=readFileSync('src/reborn/tactical-ai.ts','utf8');
 assert.match(source,/const frontiers=g\.territories\.filter\(t=>t\.owner===1&&/);
 assert.match(source,/const originalPosts=g\.world\.mapVersion>=24/);
 assert.match(source,/const posted=this\.ai33Mode==='adaptive'/);
 assert.match(source,/const fort=i>0&&i<=posted\?frontiers\[i-1\]:null/);
 assert.match(source,/const radius=fort\?68:/);
 assert.match(source,/const base=fort\?\.point\?\?protectedBases/);
 assert.match(source,/!this\.route\(u,post\)\.length/,
  'unreachable frontier posts must not steal an HQ guard');
 assert.match(source,/if\(u\.defendUntil>g\.time\)continue/,
  'active combat cannot be overridden by a scripted garrison order');
 assert.match(source,/ownedBastions\.some\(t=>distance\(u,t\.point\)<260\)/,
  'a visible intruder near a captured Bastion triggers local defense too');
 assert.match(source,/\.\.\.g\.territories\.filter\(t=>t\.owner===1\)\.map\(t=>t\.point\)/,
  'defensive priority accounts for owned Bastion positions');
});
