import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {DESERT_SURFACE_DETAIL,createDesertSurfaceDetail}
 from '../scripts/webgl-sand-surface-detail.js';
import {SANDFORGE_SAND_PBR}
 from '../scripts/webgl-sand-pbr.js';

const source=path=>readFileSync(path,'utf8');

test('no periodic sine/cosine sand bands or high-frequency photo normal ripples',()=>{
 const normal=source('scripts/webgl-sand-pbr.js');
 const sediment=source('scripts/webgl-sand-surface-detail.js');
 const preview=source('scripts/webgl-preview.js');
 assert.match(SANDFORGE_SAND_PBR.revision,/anti-banding/);
 assert.match(DESERT_SURFACE_DETAIL.revision,/nonperiodic/);
 assert.doesNotMatch(normal,/const phase=t\*\(42\*x/);
 assert.doesNotMatch(normal,/ridge\*\.055/);
 assert.match(normal,/pick\(x\+6,y\)-pick\(x-6,y\)/);
 assert.doesNotMatch(sediment,/const wavy=Math\.sin/);
 assert.doesNotMatch(sediment,/ripples=\.5\+\.5\*wavy/);
 assert.match(sediment,/softenedGrain/);
 assert.doesNotMatch(preview,/Math\.cos\(x\*\.19\+y\*\.048\)/);
 assert.match(preview,/const cell=256\/24/);
 assert.match(preview,/sun\.shadow\.normalBias=goldenHour\?\.13:\.038/);
 assert.match(preview,/sun\.shadow\.bias=goldenHour\?-\.00018:-\.00006/);
});

test('sand detail maps preserve contrast/variation without per-frame geometry',()=>{
 const renderer={capabilities:{getMaxAnisotropy:()=>8}};
 const maps=createDesertSurfaceDetail(renderer);
 assert.equal(maps.mask.image.width,512);
 assert.equal(maps.silt.image.height,512);
 for(const name of ['mask','silt','grit']){
  const map=maps[name];
  assert.equal(map.wrapS,THREE.RepeatWrapping);
  assert.equal(map.wrapT,THREE.RepeatWrapping);
  assert.equal(map.minFilter,THREE.LinearMipmapLinearFilter);
  const pixels=map.image.data;
  let min=255,max=0;
  for(let i=0;i<pixels.length;i+=97*4){
   min=Math.min(min,pixels[i]);max=Math.max(max,pixels[i]);
  }
  assert.ok(max-min>12,'multiscale '+name+' texture should not become flat');
  map.dispose();
 }
});
