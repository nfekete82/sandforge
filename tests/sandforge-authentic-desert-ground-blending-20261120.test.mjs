import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {
 DESERT_GROUND_PROFILES,DESERT_GROUND_BLEND_REVISION,
 bakeDesertGroundMasks,createDesertGroundMaskTexture
} from '../scripts/webgl-desert-ground-blending.js';

test('four original desert surfaces plus the authored plateau use genuine texture blends',()=>{
 assert.equal(Object.keys(DESERT_GROUND_PROFILES).length,5);
 const surfaces=new Set();
 for(const [id,p] of Object.entries(DESERT_GROUND_PROFILES)){
  assert.equal(p.layers.length,3,id);
  assert.equal(new Set([p.base,...p.layers]).size,4,'must use four distinct original source textures');
  assert.equal(p.zone.length,3);
  assert.ok(p.zone.every(v=>v>.1&&v<1.1));
  assert.ok(p.tiles.every(v=>v>=250&&v<=700));
  surfaces.add(p.base+'|'+p.layers.join(','));
 }
 assert.equal(surfaces.size,5);
 assert.match(DESERT_GROUND_BLEND_REVISION,/ground-blending/);
 assert.equal(bakeDesertGroundMasks('snow',{seed:32}),null);
});

test('world-space masks are deterministic, independent by map and spatially non-uniform',()=>{
 const originals=new Set();
 for(const id of Object.keys(DESERT_GROUND_PROFILES)){
  const a=bakeDesertGroundMasks(id,{seed:314159,resolution:192});
  const b=bakeDesertGroundMasks(id,{seed:314159,resolution:192});
  assert.deepEqual(a.pixels,b.pixels,'same fixed map and seed must stay identical');
  assert.equal(a.pixels.length,192*192*4);
  const colors=[];
  for(let c=0;c<3;c++){
   const vals=[];
   for(let i=c;i<a.pixels.length;i+=4)vals.push(a.pixels[i]);
   const min=Math.min(...vals),max=Math.max(...vals);
   assert.ok(max-min>75,id+' needs broad hardpan/gravel/silt coverage, not tint');
   colors.push(Math.floor(vals.reduce((x,y)=>x+y,0)/vals.length));
  }
  originals.add(colors.join(':'));
  assert.equal(a.pixels[3],255);
  assert.equal(a.pixels.at(-1),255);
 }
 assert.ok(originals.size>=3,'biome masks should not look identical');
 const other=bakeDesertGroundMasks('last-stronghold',{seed:314160,resolution:192});
 assert.notDeepEqual(other.pixels,bakeDesertGroundMasks('last-stronghold',{seed:314159,resolution:192}).pixels);
});

test('baked textures use linear world-space mask sampling, not visible repeating square tiles',()=>{
 const renderer={capabilities:{getMaxAnisotropy:()=>8}};
 const tex=createDesertGroundMaskTexture(renderer,'broken-empire',{seed:2026,resolution:128});
 assert.ok(tex.isDataTexture);
 assert.equal(tex.wrapS,THREE.ClampToEdgeWrapping);
 assert.equal(tex.wrapT,THREE.ClampToEdgeWrapping);
 assert.equal(tex.colorSpace,THREE.NoColorSpace);
 assert.equal(tex.image.width,128);
 assert.equal(tex.image.height,128);
 tex.dispose();
});

test('integration retains original physical PBR material, all 16 chunks, and native saves',()=>{
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 const ground=readFileSync('scripts/webgl-desert-ground-blending.js','utf8');
 const builder=readFileSync('scripts/build.mjs','utf8');
 assert.match(preview,/installDesertRegionalPBR/);
 assert.match(preview,/installAuthenticDesertGroundBlending/);
 assert.match(preview,/groundBlending\?\.dispose\(\)/);
 assert.match(builder,/webgl-desert-ground-blending/);
 assert.match(ground,/prev\.call\(this,shader,webglRenderer\)/);
 assert.match(ground,/#include <map_fragment>/);
 assert.match(ground,/#include <roughnessmap_fragment>/);
 assert.match(ground,/uniform sampler2D sfNaturalZones/);
 assert.match(ground,/material\.userData\.sandforgeGroundBlending/);
 assert.match(ground,/vec3 sfZones=texture2D/);
 assert.doesNotMatch(ground,/new THREE\.(?:PlaneGeometry|BoxGeometry|Mesh)\(/);
});
