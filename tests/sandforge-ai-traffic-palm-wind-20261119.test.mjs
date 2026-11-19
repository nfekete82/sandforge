import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {vehicleSpacingGap} from '../dist/src/reborn/vehicle-spacing.js';

const source=path=>readFileSync(path,'utf8');

test('AI footprints and tire impressions are visible only with actual player sight',()=>{
 const tracks=source('scripts/webgl-ground-tracks.js');
 assert.doesNotMatch(tracks,/unit\.owner!==0\|\|\s*unit\.kind/);
 assert.match(tracks,/unit\.owner!==0&&!this\.game\.canSee\(0,unit\)/);
 assert.match(tracks,/this\.last\.delete\(id\)/);
 assert.match(tracks,/vehicleTrackProfile\(unit\.kind\)/);
});

test('oasis wind animates real instance vertices with storm-driven GPU uniforms',()=>{
 const oasis=source('scripts/webgl-oases.js');
 const preview=source('scripts/webgl-preview.js');
 assert.match(oasis,/shader\.vertexShader=shader\.vertexShader\.replace\('#include <begin_vertex>'/);
 assert.match(oasis,/sfPalmCrown\*sfTip/);
 assert.match(oasis,/instanceMatrix\[3\]/);
 assert.match(oasis,/this\.game\.weather\?\.intensity/);
 assert.match(oasis,/this\.wind\.time\.value=time/);
 assert.match(preview,/oases\.update\(now\*\.001\)/);
 assert.match(preview,/desertArt\.update\(now\*\.001,game\.weather\.intensity\)/);
 const trees=source('scripts/webgl-environment.js');
 assert.match(trees,/addWindPalm\(group/);
 assert.match(trees,/const gain=\.013\+Math\.max\(0,Math\.min\(1,storm\)\)\*\.043/);
 assert.doesNotMatch(trees,/addWindPalm[\s\S]{0,200}\.world\.blocked\.fill/);
});

test('AI ground assault uses realistic tank-size lanes instead of 30-unit overlaps',()=>{
 const tactical=source('src/reborn/tactical-ai.ts');
 assert.match(tactical,/formationSlotPitch\(front\)/);
 assert.doesNotMatch(tactical,/lane=\(i%2-\.5\)\*30/);
 assert.match(tactical,/depth=220\+Math\.floor\(index\/2\)\*160/);
 const tankGap=vehicleSpacingGap({kind:'tank'},{kind:'tank'});
 assert.ok(tankGap.hard>30,'former side-by-side lanes overlapped physical tank radii');
});

test('two paused bombers never jiggle because of ground separation',()=>{
 const g=new Simulation(20261119,24);
 g.aiClock=1e8;g.tactical.plan=()=>{};
 g.units=[];g.bases=[];g.world.blocked.fill(0);
 g.world.components.fill(0);
 g.status='playing';
 const a=g.spawn(1,{x:1450,y:1500},'bomber');
 const b=g.spawn(1,{x:1450,y:1500},'bomber');
 a.hold=true;b.hold=true;
 const start=[a.x,a.y,b.x,b.y];
 g.step(.05);
 assert.deepEqual([a.x,a.y,b.x,b.y],start,
  'ground overlap correction must not force fixed-wing planes sideways');
 const sim=source('src/reborn/simulation.ts');
 assert.match(sim,/unitSpec\(u\)\.flying&&\(u\.kind==='bomber'\|\|v\.kind==='bomber'\)/);
 assert.match(sim,/state\.bestDistance-waypointDistance>=10/);
});
