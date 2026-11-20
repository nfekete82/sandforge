import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';

for(const mapId of ['burning-horizon','last-stronghold'])
 test('True WebGL2 natural PBR canyons and sculpted cliff shelves on '+mapId,
 async({page})=>{
  test.setTimeout(240000);
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  page.on('console',m=>{
   if(m.type()==='error'&&/WebGLProgram|Shader Error|VALIDATE_STATUS/i.test(m.text()))
    errors.push(m.text());
  });
  await page.setViewportSize({width:1600,height:900});
  await page.goto('/webgl-preview.html',{waitUntil:'domcontentloaded'});
  await page.locator('#sf3d-new').click();
  await page.locator('#sf3d-desert-map').selectOption(mapId);
  await page.locator('#sf3d-new-confirm').click();
  await page.waitForFunction(()=>{
   const a=window.__sandforgeWebGL;
   return a?.loaded===true&&a?.authenticDesertReady===true;
  },null,{timeout:160000});
  const report=await page.evaluate(()=>{
   const a=window.__sandforgeWebGL;
   const mesa=a.scene.getObjectByName('physical-battlefield-rocks');
   const ridge=a.scene.getObjectByName('procedural-v3-eroded-sandstone');
   const p=mesa?.geometry.getAttribute('position');
   const tint=ridge?.geometry.getAttribute('color')??mesa?.geometry.getAttribute('color');
   const avg=[0,0,0];
   const length=Math.min(500,tint?.count??0);
   for(let i=0;i<length;i++){
    avg[0]+=tint.getX(i);avg[1]+=tint.getY(i);avg[2]+=tint.getZ(i);
   }
   if(length)for(let i=0;i<3;i++)avg[i]/=length;
   return {
    map:a.desertMapId,
    realFoW:a.battlefield.fogEnabled,
    noCloudHalos:!a.atmosphere.showFrontierClouds&&a.atmosphere.fogMesh.count===0,
    mesaVertices:p?.count??0,
    ridgeVertices:ridge?.geometry.getAttribute('position')?.count??0,
    mesaPBR:Boolean(mesa?.material.map?.isTexture&&mesa?.material.normalMap?.isTexture),
    ridgePBR:Boolean(ridge?.material.map?.isTexture&&ridge?.material.normalMap?.isTexture),
    tint:avg,
    rockyOutcropDraws:a.scene.children.filter(o=>o.userData?.rockOutcrops).length,
    genuineGlbDraws:a.canyonOutcrops?.drawCalls??0,
    genuinePbrGlb:a.canyonOutcrops?.meshes.every(m=>m.userData?.realPbrMaterialShared&&m.material.map?.isTexture)??false,
    blockedCount:a.game.world.blocked.filter(x=>x>0).length
   };
  });
  console.log('AUTHENTIC_CANYON_REVIEW '+JSON.stringify(report));
  expect(report.map).toBe(mapId);
  // Fixed desert battlegrounds use physical ridge arrays, legacy mesa sets may be empty.
  expect(report.mesaVertices).toBeGreaterThanOrEqual(0);
  expect(report.ridgeVertices).toBeGreaterThan(500);
  expect(report.ridgePBR).toBe(true);
  if(report.mesaVertices)expect(report.mesaPBR).toBe(true);
  expect(report.realFoW&&report.noCloudHalos).toBe(true);
  expect(report.rockyOutcropDraws).toBeGreaterThanOrEqual(0);
  expect(report.genuineGlbDraws).toBeGreaterThan(0);
  expect(report.genuinePbrGlb).toBe(true);
  if(mapId==='last-stronghold'){
   expect(report.tint[0]).toBeLessThan(.28);
   expect(report.tint[1]).toBeLessThan(.29);
   expect(report.tint[2]).toBeLessThan(.31);
  }
  expect(errors).toEqual([]);
  // Screenshot only: reveal terrain and focus on a real blocked plateau,
  // without changing gameplay fog for an actual human player.
  await page.evaluate(()=>{
   const a=window.__sandforgeWebGL,half=a.game.world.size/2;
   const ridge=a.terrain.ridges.find(r=>r.spine?.length>1);
   const mesa=a.terrain.mesas[0];
   a.battlefield.fogEnabled=false;a.battlefield.updateFog();
   const center=ridge?.spine[Math.floor(ridge.spine.length/2)]??
    {x:mesa.outline.reduce((s,p)=>s+p.x,0)/mesa.outline.length,
     y:mesa.outline.reduce((s,p)=>s+p.y,0)/mesa.outline.length};
   const cx=center.x,cz=center.y;
   const h=a.heightAt(cx,cz);
   a.controls.target.set(cx-half,h+70,cz-half);
   a.camera.position.set(cx-half+480,h+570,cz-half+520);
   a.camera.zoom=1.55;a.camera.updateProjectionMatrix();a.controls.update();
  });
  await page.waitForTimeout(900);
  mkdirSync('artifacts/screenshots',{recursive:true});
  await page.screenshot({path:'artifacts/screenshots/'+mapId+'-canyon-sculpted-pbr.png'});
 });
