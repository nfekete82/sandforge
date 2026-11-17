import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {sitesVisuallyOverlap} from '../dist/src/reborn/construction-spacing.js';
import {wallDragSegments,validatedWallDrag,WALL_CHAIN_PITCH,WALL_CHAIN_MAX}
 from '../scripts/webgl-wall-drag.js';

test('left-drag creates perfectly adjoining, oriented cardinal wall segments',()=>{
 assert.equal(WALL_CHAIN_PITCH,109);
 const east=wallDragSegments({x:310,y:500},{x:1000,y:570},1500);
 assert.equal(east.length,7);
 assert.ok(east.every(s=>s.facing===0&&s.point.y===500));
 for(let i=1;i<east.length;i++){
  assert.equal(east[i].point.x-east[i-1].point.x,109);
  assert.equal(sitesVisuallyOverlap('wall',east[i-1].point,0,
   'wall',east[i].point,0),false,'walls meet end-to-end without overlap');
 }
 const north=wallDragSegments({x:620,y:960},{x:590,y:400},1500);
 assert.equal(north.length,6);
 assert.ok(north.every(s=>s.facing===2&&s.point.x===620));
 for(let i=1;i<north.length;i++)
  assert.equal(north[i-1].point.y-north[i].point.y,109);
 assert.equal(wallDragSegments({x:500,y:500},{x:500,y:500},1500).length,1);
});

test('drag reaches physical borders without placing walls outside the map',()=>{
 const size=6240;
 for(const [start,end,axis] of [
  [{x:200,y:300},{x:6240,y:300},'x'],
  [{x:6000,y:300},{x:-100,y:300},'x'],
  [{x:80,y:230},{x:80,y:6240},'y'],
  [{x:320,y:6000},{x:320,y:-100},'y']
 ]){
  const pieces=wallDragSegments(start,end,size,{axis});
  assert.ok(pieces.length>25);
  assert.ok(pieces.length<=WALL_CHAIN_MAX);
  for(const part of pieces){
   assert.ok(part.point.x>=26&&part.point.x<=size-26);
   assert.ok(part.point.y>=26&&part.point.y<=size-26);
  }
 }
 assert.deepEqual(wallDragSegments(null,{x:50,y:50},6240),[]);
});

test('rock/structure collision stops the entire prefix, not skipping ahead',()=>{
 const game={world:{size:1600},credits:[3000],
  buildError:(_owner,_kind,p)=>p.x>=430?'Felsen blockieren die Baustelle.':null};
 const a=validatedWallDrag(game,{x:100,y:400},{x:1100,y:400});
 assert.equal(a.buildable,4);
 assert.equal(a.stopReason,'Felsen blockieren die Baustelle.');
 assert.ok(a.segments.slice(0,4).every(s=>s.valid));
 assert.ok(a.segments.slice(4).every(s=>!s.valid));
 const money=validatedWallDrag({...game,credits:[150],buildError:()=>null},
  {x:100,y:400},{x:800,y:400});
 assert.equal(money.buildable,2);
 assert.equal(money.stopReason,'Zu wenig Credits');
});

test('walls may touch the edge beyond sectors; rock, actual overlapping walls and units still stop them',()=>{
 const g=new Simulation(2026,0);g.status='playing';g.credits[0]=100000;
 g.world.blocked.fill(0);g.world.components.fill(0);
 // Find a safe edge-band coordinate; legacy maps have bastion circles and
 // HQs in fixed areas, so a dynamic valid choice avoids brittle fixtures.
 const at=Array.from({length:22},(_,i)=>({x:64,y:250+i*140}))
  .find(p=>g.buildError(0,'wall',p,0)===null);
 assert.ok(at,'must be allowed to place a wall right up to the map edge');
 assert.match(g.buildError(0,'wall',{...at,x:14},0)??'',
  /Felsen|Kartenrand/);
 const second={x:at.x+109,y:at.y};
 assert.equal(g.buildError(0,'wall',second,0),null,
  'a second seamless wall can adjoin the first');
 const builder=g.units.find(u=>u.owner===0&&u.kind==='engineer');
 assert.ok(builder);
 g.testMode=true; // regular paid site, but no artificial build-duration wait
 const built=g.build(0,'wall',at,[builder.id],0);
 assert.ok(built,'first real wall must construct on a non-sector border');
 assert.deepEqual({x:built.x,y:built.y},at);
 assert.equal(g.buildError(0,'wall',second,0),null,
  'adjacent wall must remain legal after the first is committed');
 const next=g.build(0,'wall',second,[builder.id],0);
 assert.ok(next,'adjoining second wall is a real destructible building');
 const packed=g.save();
 const restored=Simulation.load(packed);
 for(const original of [built,next]){
  const b=restored.bases.find(b=>b.id===original.id);
  assert.deepEqual({x:b.x,y:b.y},{x:original.x,y:original.y},
   'saving/loading cannot shift border walls apart');
 }
 const affected=g.world.index({x:at.x+220,y:at.y});
 g.world.blocked[affected]=1;
 assert.match(g.buildError(0,'wall',{x:at.x+218,y:at.y},0)??'',
  /Felsen|Kartenrand/);
});

test('rendered drag preview uses cheap instances, owns no buildings and releases cleanly',()=>{
 const source=readFileSync('scripts/webgl-battlefield.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(source,/validatedWallDrag\(this.game,drag.origin,end,0/);
 assert.match(source,/new THREE.InstancedMesh\(geom.clone\(\),material,WALL_CHAIN_MAX\)/);
 assert.match(source,/this.finishWallDrag\(event\)/);
 assert.match(source,/this.resetWallPreview\(\)/);
 assert.match(source,/if\(!segment.valid\)break/);
 assert.match(source,/submitConstruction\(this.game,'wall',segment.point/);
 assert.match(source,/m.geometry.dispose\(\);m.material.dispose\(\)/);
 assert.match(source,/WALL_CHAIN_DRAG_THRESHOLD/);
 assert.match(build,/cpSync\('scripts\/webgl-wall-drag.js','dist\/webgl-wall-drag.js'\)/);
});
