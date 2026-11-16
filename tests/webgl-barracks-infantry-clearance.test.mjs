import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MODEL_HEIGHTS,visualUnitScale,calibratedScale} from '../scripts/webgl-scale.js';
import {UNITS,BUILDINGS} from '../dist/src/reborn/catalog.js';

const foot=['infantry','medic','engineer','heavy','rocket'];

test('all infantry silhouettes fit beneath the final PBR barracks door',()=>{
 // The real PBR double door is roughly 27 world units high once the
 // 158-unit barracks GLB is normalized. A ~26-unit human leaves clearance.
 for(const kind of foot){
  const visualHeight=MODEL_HEIGHTS[kind]*visualUnitScale(kind);
  assert.ok(visualHeight>22,kind+' should remain legible at RTS zoom');
  assert.ok(visualHeight<=26.5,
   kind+' must fit beneath the authored barracks doorway (current '+visualHeight+')');
  const bounds={x:4.4,y:5.1,z:3.9};
  const normalized=calibratedScale(kind,'unit',bounds,UNITS[kind].width);
  assert.ok(Math.abs(bounds.y*normalized*visualUnitScale(kind)-visualHeight)<1e-8,
   kind+' actual GLB normalization must follow the same visible height');
 }
});

test('visual infantry resizing never changes authoritative gameplay dimensions',()=>{
 assert.equal(BUILDINGS.barracks.width,158);
 assert.equal(BUILDINGS.barracks.radius,53);
 for(const kind of foot){
  assert.ok(UNITS[kind].radius>0);
  assert.ok(UNITS[kind].width>0);
  assert.ok(UNITS[kind].range>0);
  assert.ok(UNITS[kind].speed>0);
 }
 const source=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(source,/model\.scale\.multiplyScalar\(scale\)/);
 assert.match(source,/visualUnitScale\(entry\.kind\)/);
 assert.match(source,/entry\.node\.position\.copy\(this\.pos\(x,z,visualGround/);
});

test('infantry HP bar and muzzle flash follow the corrected proportions',()=>{
 const source=readFileSync('scripts/webgl-actor-presentation.js','utf8');
 assert.match(source,/infantry\.has\(kind\)\?22:air\.has\(kind\)\?44:36/);
 assert.match(source,/infantry\.has\(kind\)\?43:air\.has\(kind\)\?49:56/);
 assert.match(source,/infantry\.has\(kind\)\?17:air\.has\(kind\)\?36:kind==='tank'\?40:35/);
 assert.match(source,/infantry\.has\(kind\)\?26:38\):60/);
});
