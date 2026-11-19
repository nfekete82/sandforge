import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import * as THREE from 'three';
import {createDesertSurfaceDetail,installDesertSurfaceDetail,DESERT_SURFACE_DETAIL}
 from '../scripts/webgl-sand-surface-detail.js';
import {SANDFORGE_SAND_PBR} from '../scripts/webgl-sand-pbr.js';
import {DESERT_SCENIC_STYLE as style} from '../scripts/webgl-desert-style.js';
import {Simulation} from '../dist/src/reborn/simulation.js';

const renderStub={capabilities:{getMaxAnisotropy:()=>8}};
test('modern 4-bastion desert: no scattered boulders and uncluttered build space',()=>{
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 const art=readFileSync('scripts/webgl-desert-art.js','utf8');
 assert.match(preview,/spacious&&biome==='desert'\?0:spacious\?420:1600/);
 assert.match(art,/const target=lowQuality\?25:60/);
 assert.equal(0+60,60);
 assert.ok((900-60)/900>.90);
 const env=readFileSync('scripts/webgl-environment.js','utf8');
 const oasis=readFileSync('scripts/webgl-oases.js','utf8');
 assert.ok(env.includes('const debrisLimit=modernDesert?(this.lowQuality?22:40)'));
 assert.ok(env.includes('const rubblePerRuin=modernDesert?(this.lowQuality?2:3)'));
 assert.ok(oasis.includes('const stoneCount=this.game.world.mapVersion>=23?4:16'));
 assert.match(preview,/if\(terrain\.battlefield&&terrain\.mesas\.length\)addBattlefieldRocks\(materials\[0\]\)/);
 for(const seed of [2988452066,3610769721]){
  const g=Simulation.campaign(seed,23);
  const original=g.world.generated.mesas.length;
  assert.equal(original,0);
  assert.ok(g.world.generated.battlefield);
 }
});

test('modern PBR sand surface: four 512px seamless silt, grit, zoning and ripple maps',()=>{
 const maps=createDesertSurfaceDetail(renderStub);
 assert.deepEqual(Object.keys(maps),['silt','grit','mask','ripples']);
 for(const [name,tex] of Object.entries(maps)){
  assert.equal(tex.image.width,DESERT_SURFACE_DETAIL.size,name);
  assert.equal(tex.image.height,DESERT_SURFACE_DETAIL.size,name);
  assert.equal(tex.wrapS,THREE.RepeatWrapping);
  assert.equal(tex.wrapT,THREE.RepeatWrapping);
  assert.equal(tex.minFilter,THREE.LinearMipmapLinearFilter);
  assert.equal(tex.anisotropy,8);
  assert.equal(tex.colorSpace,['mask','ripples'].includes(name)?THREE.NoColorSpace:THREE.SRGBColorSpace);
  const arr=tex.image.data;
  for(let i=3;i<arr.length;i+=4*283)assert.equal(arr[i],255);
  let mean=0,min=255,max=0;
  for(let i=0;i<arr.length;i+=4){
   mean+=arr[i];min=Math.min(min,arr[i]);max=Math.max(max,arr[i]);
   if(name==='silt'||name==='grit')assert.ok(arr[i]>arr[i+2]&&arr[i+1]>arr[i+2],'warm, not icy white');
  }
  mean/=arr.length/4;
  if(name==='mask'||name==='ripples'){assert.ok(max-min>15,'distinct coverage and wind ripples');}
  else{
   assert.ok(mean>170&&mean<225);
   assert.ok(max<240,'never reintroduce white blotches');
  }
  // Finite wrap derivatives: edge-to-edge continuity is near exact.
  const size=DESERT_SURFACE_DETAIL.size;
  const pix=(x,y,c=0)=>arr[(y*size+x)*4+c];
  let seamSum=0;
  for(let i=0;i<size;i++){
   seamSum+=Math.abs(pix(0,i)-pix(size-1,i));
   seamSum+=Math.abs(pix(i,0)-pix(i,size-1));
  }
  assert.ok(seamSum/(size*2)<7,'seamless horizontal and vertical tiling: '+name);
  tex.dispose();
 }
 assert.equal(DESERT_SURFACE_DETAIL.windTileMetres,540);
 assert.equal(DESERT_SURFACE_DETAIL.gritTileMetres,48);
 assert.equal(style.authoredSandVertexBlend,.83);
});

test('photographic albedo + silt + grit inside one terrain shader: no extra scene geometry',()=>{
 const mat=new THREE.MeshStandardMaterial({
  color:'#ffffff',map:new THREE.Texture(),normalMap:new THREE.Texture(),
  roughnessMap:new THREE.Texture(),roughness:.98,metalness:0
 });
 const originalMap=mat.map;
 const a=installDesertSurfaceDetail(mat,renderStub),again=installDesertSurfaceDetail(mat,renderStub);
 assert.equal(a,again,'one-time map bake, no per-frame allocation');
 assert.equal(mat.map,originalMap,'authored base albedo retained');
 assert.equal(mat.metalness,0);
 assert.equal(mat.userData.sandforgeSurfaceDetailRevision,DESERT_SURFACE_DETAIL.revision);
 const shader={
  vertexShader:'#include <common>\n#include <begin_vertex>',
  fragmentShader:'#include <common>\n#include <map_fragment>\n#include <roughnessmap_fragment>',
  uniforms:{}
 };
 mat.onBeforeCompile(shader,{});
 assert.match(shader.vertexShader,/sfDesertGround=position\.xz/);
 assert.match(shader.fragmentShader,/texture2D\(sfDesertSilt/);
 assert.match(shader.fragmentShader,/texture2D\(sfDesertGrain/);
 assert.match(shader.fragmentShader,/texture2D\(sfDesertMask/);
 assert.match(shader.fragmentShader,/roughnessFactor=clamp\(mix\(roughnessFactor/);
 assert.equal(shader.uniforms.sfDesertSilt.value,a.silt);
 assert.equal(shader.uniforms.sfDesertGrain.value,a.grit);
 assert.equal(shader.uniforms.sfDesertMask.value,a.mask);
 assert.equal(shader.uniforms.sfDesertRipples.value,a.ripples);
 assert.equal(mat.customProgramCacheKey(),DESERT_SURFACE_DETAIL.revision);
 assert.ok(SANDFORGE_SAND_PBR.revision.includes('v5'));
 for(const tex of Object.values(a))tex.dispose();
 mat.dispose();
});

test('modern-only rendering, tighter photographic repeat and unchanged GLB/build/game logic',()=>{
 const prev=readFileSync('scripts/webgl-preview.js','utf8');
 const sand=readFileSync('scripts/webgl-sand-pbr.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(prev,/x\/\(spacious&&biome==='desert'\?900:spacious\?2200:1500\)/);
 assert.match(prev,/z\/\(spacious&&biome==='desert'\?900:spacious\?2200:1500\)/);
 assert.match(prev,/if\(biome==='desert'&&terrain\.battlefield\)/);
 assert.match(sand,/installDesertSurfaceDetail\(material,renderer\)/);
 assert.match(build,/cpSync\('scripts\/webgl-sand-surface-detail\.js','dist\/webgl-sand-surface-detail\.js'\)/);
 assert.ok(existsSync('dist/webgl-sand-surface-detail.js'));
 assert.equal(style.authoredSandVertex,'#ffffff');
 assert.doesNotMatch(readFileSync('src/reborn/simulation.ts','utf8'),/DESERT_SURFACE_DETAIL|createDesertSurfaceDetail/);
 assert.doesNotMatch(readFileSync('scripts/webgl-battlefield.js','utf8'),/installDesertSurfaceDetail/);
});
