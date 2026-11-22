import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {wallColliderSamples,wallTerrainPlacementError} from '../dist/src/reborn/defensive-wall.js';
import {vehicleStructureColliders} from '../dist/src/reborn/vehicle-structure-collision.js';
import {infantryStructureColliders} from '../dist/src/reborn/infantry-structure-collision.js';
import {sitesVisuallyOverlap} from '../dist/src/reborn/construction-spacing.js';
import {snapWallSiteToMap} from '../scripts/webgl-wall-drag.js';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';

function site(id,x,y,owner=0,facing=0){
 return {id,x,y,owner,facing,kind:'wall',hp:BUILDINGS.wall.hp,
  buildRemaining:0,territory:0,radius:24,queue:[],queueTypes:[],
  production:0,cooldown:0,rally:null};
}
function game(){
 const g=new Simulation(2026,24);
 g.status='playing';g.credits[0]=1000;g.credits[1]=1000;
 return g;
}

test('click either wall of a valid neighboring pair: one 218-wide gate occupies their exact union',()=>{
 for(const facing of [0,1,2,3]){
  const g=game(),vertical=facing>=2;
  const first=site(90011,1400,1400,0,facing);
  const mate=site(90012,1400+(vertical?0:109),
   1400+(vertical?109:0),0,facing);
  g.bases.push(first,mate);
  assert.equal(g.findWallGatePartner(0,first.id)?.id,mate.id);
  assert.equal(g.findWallGatePartner(0,mate.id)?.id,first.id);
  assert.equal(g.convertWallToGate(0,first.id),true);
  assert.equal(g.bases.filter(b=>[first.id,mate.id].includes(b.id)).length,1);
  assert.equal(first.x,(1400+mate.x)/2);
  assert.equal(first.y,(1400+mate.y)/2);
  assert.equal(first.kind,'wallGate');
  assert.equal(first.gateSpan,2);
  assert.equal(first.facing,facing);
  assert.equal(first.hp,BUILDINGS.wallGate.hp);
  assert.equal(g.credits[0],940);
  assert.equal(vehicleStructureColliders([first]).length,5);
  assert.equal(infantryStructureColliders([first]).length,5);
  assert.equal(g.navigationBases(0).includes(first),false);
  assert.equal(g.navigationBases(1).includes(first),true);
  assert.equal(g.convertWallToGate(0,first.id),false);
 }
});

test('retrofit refuses a missing, incomplete, enemy, diagonal or nonparallel neighbor',()=>{
 const cases=[
  {note:'missing',other:null},
  {note:'enemy',other:{owner:1}},
  {note:'unfinished',other:{buildRemaining:5}},
  {note:'different axis',other:{facing:2}},
  {note:'diagonal',other:{y:1408}},
  {note:'far gap',other:{x:1516}},
  {note:'destroyed',other:{hp:0}}
 ];
 for(const {note,other} of cases){
  const g=game(),first=site(92011,1400,1400);
  g.bases.push(first);
  if(other)g.bases.push({...site(92012,1509,1400),...other});
  const before=JSON.stringify(g.bases);
  assert.equal(g.findWallGatePartner(0,first.id),null,note);
  assert.equal(g.convertWallToGate(0,first.id),false,note);
  assert.equal(JSON.stringify(g.bases),before,note);
  assert.equal(g.credits[0],1000,note);
 }
});

test('physical placement and click snapping include full 218-unit footprint',()=>{
 const map=2600,ground={
  size:map,blocked:new Uint8Array(map*map),
  index:p=>p.x<0||p.y<0||p.x>=map||p.y>=map?-1:
   Math.floor(p.y)*map+Math.floor(p.x),
  terrainHeight:()=>0,terrainSlope:()=>0
 };
 const p={x:500,y:500};
 assert.equal(wallTerrainPlacementError(ground,p,0,2),null);
 ground.blocked[ground.index({x:599,y:500})]=1;
 assert.match(wallTerrainPlacementError(ground,p,0,2),/Felsen|Bergwand/);
 assert.equal(wallTerrainPlacementError(ground,p,0,1),null,
  'the same far rock is outside a one-section legacy wall');
 assert.deepEqual(snapWallSiteToMap({x:0,y:500},0,map,'wallGate'),
  {x:110,y:500});
 assert.deepEqual(snapWallSiteToMap({x:500,y:0},2,map,'wallGate'),
  {x:500,y:110});
 assert.equal(sitesVisuallyOverlap('wallGate',p,0,'wall',{x:663,y:500},0),false);
 assert.equal(sitesVisuallyOverlap('wallGate',p,0,'wall',{x:608,y:500},0),true);
});

test('new gate span survives saves; unmarked existing gates stay narrow',()=>{
 const g=game(),a=site(94011,1500,1500),b=site(94012,1609,1500);
 g.bases.push(a,b);
 assert.equal(g.convertWallToGate(0,a.id),true);
 const saved=Simulation.load(g.save());
 const restored=saved.bases.find(x=>x.id===a.id);
 assert.equal(restored?.gateSpan,2);
 assert.equal(wallColliderSamples(restored).length,5);
 const old={...restored};
 delete old.gateSpan;
 assert.equal(wallColliderSamples(old).length,3,
  'pre-existing saved single-width wall gates remain backward compatible');
});
