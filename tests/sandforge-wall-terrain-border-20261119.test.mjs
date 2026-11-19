import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {World} from '../dist/src/reborn/world.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {wallTerrainPlacementError,wallTerrainPitch} from '../dist/src/reborn/defensive-wall.js';
import {wallDragSegments,snapWallSiteToMap,validatedWallDrag} from '../scripts/webgl-wall-drag.js';
import {sitesVisuallyOverlap} from '../dist/src/reborn/construction-spacing.js';

function terrainWorld(){
 const w=new World(2026,24,'mixed');
 assert.ok(w.generated?.battlefield,'modern map has a real heightfield');
 w.blocked.fill(0);w.opaque.fill(0);
 w.terrainSlope=()=>.48;
 w.terrainHeight=(x,y)=>x*.48+y*.08;
 return w;
}

test('wall terrain-specific rules permit gradual hills far beyond the old .24 and 24-height caps',()=>{
 const w=terrainWorld(),p={x:w.size*.55,y:w.size*.45};
 assert.equal(wallTerrainPlacementError(w,p,0),null);
 assert.equal(wallTerrainPlacementError(w,p,2),null);
 const longRise=Math.abs(w.terrainHeight(p.x+49,p.y)-w.terrainHeight(p.x-49,p.y));
 assert.ok(longRise>24,'regression: old slab rule rejected this exact valid contour');
 assert.ok(Math.abs(wallTerrainPitch(w,p,0)-Math.atan(.48))<.001);
 assert.ok(Math.abs(wallTerrainPitch(w,p,2)+Math.atan(.08))<.001);
});

test('all four rotated walls can touch true map edge without crossing into black void',()=>{
 const w=terrainWorld();
 for(const [f,p] of [
  [0,{x:55,y:17}],
  [1,{x:w.size-55,y:w.size-17}],
  [2,{x:17,y:55}],
  [3,{x:w.size-17,y:w.size-55}],
 ]){
  assert.equal(wallTerrainPlacementError(w,p,f),null,'orientation '+f+' at the map edge');
  const snapped=snapWallSiteToMap({x:p.x<100?0:w.size,y:p.y<100?0:w.size},f,w.size);
  assert.deepEqual(snapped,p);
 }
 for(const p of [{x:45,y:17},{x:55,y:9}]){
  assert.match(wallTerrainPlacementError(w,p,0),/Kartenrand/);
 }
});

test('true cliff cells, vertical cliffs and rock walls remain forbidden across entire rotated footprint',()=>{
 const w=terrainWorld(),p={x:Math.floor(w.size/2),y:Math.floor(w.size/2)};
 const rock={x:p.x+27,y:p.y+8};
 w.blocked[w.index(rock)]=1;
 assert.match(wallTerrainPlacementError(w,p,0),/Felsen|Bergwand/);
 w.blocked.fill(0);
 w.terrainSlope=()=>1.55;
 assert.match(wallTerrainPlacementError(w,p,0),/Felswand/);
 w.terrainSlope=()=>.02;
 w.terrainHeight=(x,y)=>x>p.x?250:0;
 assert.match(wallTerrainPlacementError(w,p,0),/Geländekante/);
});

test('wall drag reaches border using real 109x32 footprint, not old 64/26 padding',()=>{
 const size=6240;
 const across=wallDragSegments({x:0,y:0},{x:size,y:0},size);
 assert.ok(across.length>30);
 assert.equal(across[0].point.x,55);
 assert.equal(across[0].point.y,17);
 assert.ok(across.at(-1).point.x<=size-55);
 assert.ok(size-55-across.at(-1).point.x<109);
 const along=wallDragSegments({x:0,y:0},{x:0,y:size},size);
 assert.equal(along[0].point.x,17);
 assert.equal(along[0].point.y,55);
 assert.equal(along[0].facing,2);
 assert.deepEqual(snapWallSiteToMap({x:-30,y:size+30},0,size),{x:55,y:size-17});
 assert.deepEqual(snapWallSiteToMap({x:-30,y:size+30},2,size),{x:17,y:size-55});
});

test('wall chain still stops at first rock and cannot silently skip to the other side',()=>{
 const fake={
  world:{size:3600},
  credits:[10000,10000],
  buildError:(_owner,kind,p)=>p.x>260?'Felsen blockieren die Strecke.':null
 };
 const plan=validatedWallDrag(fake,{x:55,y:170},{x:550,y:170},0,{wallCost:75});
 assert.equal(plan.buildable,2);
 assert.equal(plan.segments[0].valid,true);
 assert.equal(plan.segments[1].valid,true);
 assert.equal(plan.segments[2].valid,false);
 assert.match(plan.stopReason,/Felsen/);
 assert.equal(plan.segments[3].valid,false);
 assert.match(plan.segments[3].reason,/hinter einem Hindernis/);
});

test('wall/building collisions and walls themselves still block the actual gameplay',()=>{
 assert.equal(sitesVisuallyOverlap('wall',{x:1000,y:1000},0,
  'wall',{x:1109,y:1000},0),false);
 assert.equal(sitesVisuallyOverlap('wall',{x:1000,y:1000},0,
  'wall',{x:1060,y:1000},0),true);
 const src=readFileSync('src/reborn/simulation.ts','utf8');
 assert.match(src,/wallTerrainPlacementError\(this\.world,p,facing\)/);
 assert.match(src,/sitesVisuallyOverlap\(/);
 assert.match(src,/siteNearBastion\(kind,p,facing,t\.point\)/);
 assert.match(src,/segments\.some\(c=>distance\(u,c\)/);
 assert.match(src,/if\(this\.credits\[owner\]<spec\.cost\)/);
});

test('real Simulation.buildError accepts distant hill walls and rejects rock intersecting the same site',()=>{
 const g=new Simulation(2026,24);
 g.credits[0]=99999;
 if(!g.hasHeadquarters(0)){
  g.bases.push({id:99950,owner:0,kind:'headquarters',
   x:300,y:300,hp:1600,territory:0,radius:75,
   queue:[],queueTypes:[],production:0,buildRemaining:0,cooldown:0,rally:null});
 }
 g.world.blocked.fill(0);
 g.world.terrainSlope=()=>.47;
 g.world.terrainHeight=(x,y)=>x*.47;
 let p;
 for(const x of [.24,.36,.48,.62,.73,.83])for(const y of [.24,.36,.48,.62,.73,.83]){
  const candidate={x:g.world.size*x,y:g.world.size*y};
  if(!g.buildError(0,'wall',candidate,0)){p=candidate;break;}
  if(p)break;
 }
 assert.ok(p,'find an empty slope outside real bastion/building footprints');
 assert.equal(g.buildError(0,'wall',p,0),null);
 g.world.blocked[g.world.index(p)]=1;
 assert.match(g.buildError(0,'wall',p,0),/Felsen|Bergwand/);
});

test('built, single preview, and drag preview all use the same terrain-following wall pitch',()=>{
 const render=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(render,/wallTerrainPitch\(this\.world,segment\.point,segment\.facing\)/);
 assert.match(render,/wallTerrainPitch\(this\.world,p,this\.placementFacing\)/);
 assert.match(render,/wallTerrainPitch\(this\.world,b,b\.facing\?\?0\)/);
 assert.match(render,/snapWallSiteToMap\(p,this\.placementFacing,this\.world\.size\)/);
 assert.match(render,/submitConstruction\(this\.game,kind,site,this\.selected/);
});
