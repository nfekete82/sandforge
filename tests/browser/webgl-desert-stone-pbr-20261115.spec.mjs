import {test,expect} from '@playwright/test';

test('4-bastion desert cliffs and loose stones share matching PBR atlas and warm material color',async({page})=>{
 test.setTimeout(140000);
 const errors=[];page.on('pageerror',err=>errors.push(err.message));
 await page.goto('/?bastions=4&seed=2988452066&play=1&terrain=random&biome=desert&pause=1',{
  waitUntil:'domcontentloaded'
 });
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded,null,{timeout:115000});
 const result=await page.evaluate(async()=>{
  const {sharedStoneMaps}=await import('/webgl-rock-materials.js');
  const gl=window.__sandforgeWebGL;
  const rock=gl.scene.getObjectByName('physical-battlefield-rocks');
  if(!rock)throw Error('physical canyon rocks not present');
  const maps=sharedStoneMaps(false);
  const material=rock.material;
  const loose=gl.scene.children.filter(x=>x.isInstancedMesh&&x.material?.map===maps.map);
  const color=material.color;
  const a=new Float32Array(4);
  const renderer=gl.renderer;
  const glError=renderer.getContext().getError();
  return {
   hasCliffs:!!rock,
   sameAlbedo:material.map===maps.map,
   sameNormal:material.normalMap===maps.normalMap,
   sameRough:material.roughnessMap===maps.roughnessMap,
   roughness:material.roughness,
   warm:color.r>=color.b,
   looseInstanced:loose.length>=1,
   pausedDeliberately:!gl.simulationRunning,
   rendererDrawCalls:renderer.info.render.calls,
   glError
  };
 });
 expect(result.hasCliffs).toBe(true);
 expect(result.sameAlbedo).toBe(true);
 expect(result.sameNormal).toBe(true);
 expect(result.sameRough).toBe(true);
 expect(result.roughness).toBeGreaterThanOrEqual(.96);
 expect(result.warm).toBe(true);
 expect(result.looseInstanced).toBe(true);
 expect(result.pausedDeliberately).toBe(true);
 expect(result.rendererDrawCalls).toBeGreaterThan(0);
 expect(result.glError).toBe(0);
 expect(errors).toEqual([]);
});
