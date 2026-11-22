import {test,expect} from '@playwright/test';

test('real desert scene: sparse rocks and one rich 3-texture PBR sand material',async({page})=>{
 test.setTimeout(155000);
 const errors=[],shaderErrors=[],requests=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',msg=>{
  if(msg.type()==='error'&&/WebGLProgram|shader error|GL_INVALID|three\.WebGL/i.test(msg.text()))
   shaderErrors.push(msg.text());
 });
 page.on('request',req=>{if(req.url().includes('sand-wind-albedo-v1.webp'))requests.push(req.url());});
 await page.goto('/?bastions=4&seed=2988452066&play=1&terrain=random&biome=desert&pause=1',{
  waitUntil:'domcontentloaded'
 });
 await page.waitForFunction(()=>{
  const g=window.__sandforgeWebGL;
  return g?.loaded&&g.scene.children.some(o=>o.userData?.terrain&&
   o.material?.userData?.sandforgeSurfaceDetailRevision);
 },null,{timeout:135000});
 const result=await page.evaluate(async()=>{
  const game=window.__sandforgeWebGL;
  const THREE=await import('three');
  const {sharedStoneMaps}=await import('/webgl-rock-materials.js');
  const {DESERT_SURFACE_DETAIL}=await import('/webgl-sand-surface-detail.js');
  const ground=game.scene.children.filter(x=>x.userData?.terrain);
  const material=ground[0].material;
  const details=material.userData.sandforgeSurfaceDetail;
  const stoneMap=sharedStoneMaps(false).map;
  const loose=game.scene.children.filter(x=>x.isInstancedMesh&&x.material?.map===stoneMap);
  const wash=game.scene.getObjectByName('visual-desert-dry-wash-pebbles');
  const shader={
   vertexShader:'#include <common>\n#include <begin_vertex>',
   fragmentShader:'#include <common>\n#include <map_fragment>\n#include <roughnessmap_fragment>',
   uniforms:{}
  };
  material.onBeforeCompile(shader,game.renderer);
  const glError=game.renderer.getContext().getError();
  return {
   chunks:ground.length,
   shared:ground.every(x=>x.material===material),
   image:material.map?.image?.width,
   normal:!!material.normalMap,
   roughness:!!material.roughnessMap,
   materialRevision:material.userData.sandforgeSurfaceDetailRevision,
   mask:details.mask.image.width,
   silt:details.silt.image.width,
   grit:details.grit.image.width,
   injection:shader.fragmentShader.includes('sfSediment')&&
     shader.fragmentShader.includes('sfMineral'),
   sharedUniforms:shader.uniforms.sfDesertSilt.value===details.silt&&
     shader.uniforms.sfDesertGrain.value===details.grit,
   ripplesTileMetres:DESERT_SURFACE_DETAIL.windTileMetres,
   looseCount:loose.reduce((v,x)=>v+x.count,0),
   washCount:wash?.count??0,
   drawCalls:game.renderer.info.render.calls,
   paused:!game.simulationRunning,
   glError
  };
 });
 expect(result.chunks).toBe(16);
 expect(result.shared).toBe(true);
 expect(result.image).toBe(512);
 expect(result.normal).toBe(true);
 expect(result.roughness).toBe(true);
 expect(result.mask).toBe(512);
 expect(result.silt).toBe(512);
 expect(result.grit).toBe(512);
 expect(result.materialRevision).toContain('v5');
 expect(result.injection).toBe(true);
 expect(result.sharedUniforms).toBe(true);
 expect(result.ripplesTileMetres).toBe(540);
 expect(result.looseCount).toBeLessThanOrEqual(250);
 expect(result.washCount).toBeLessThanOrEqual(60);
 expect(result.looseCount).toBeGreaterThan(0);
 expect(result.drawCalls).toBeGreaterThan(0);
 expect(result.paused).toBe(true);
 expect(result.glError).toBe(0);
 expect(requests.length).toBeGreaterThan(0);
 expect(shaderErrors).toEqual([]);
 expect(errors).toEqual([]);
});
