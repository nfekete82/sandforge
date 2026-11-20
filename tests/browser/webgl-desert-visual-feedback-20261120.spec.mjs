import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';

for(const mapId of ['broken-empire','last-stronghold']){
 test('Sandforge real Chromium 3D visual fixes: '+mapId,async({page})=>{
  test.setTimeout(240000);
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{
   if(m.type()==='error'&&/WebGLProgram|shader|VALIDATE_STATUS/i.test(m.text()))
    errors.push(m.text());
  });
  await page.setViewportSize({width:1600,height:900});
  await page.goto('/webgl-preview.html',{waitUntil:'domcontentloaded'});
  await page.locator('#sf3d-new').click();
  await page.locator('#sf3d-desert-map').selectOption(mapId);
  await page.locator('#sf3d-new-confirm').click();
  await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true&&
   window.__sandforgeWebGL?.authenticDesertReady===true,
   null,{timeout:170000});
  const report=await page.evaluate(()=>{
   const a=window.__sandforgeWebGL;
   const mesa=a.scene.getObjectByName('physical-battlefield-rocks');
   const colors=mesa?.geometry?.getAttribute('color');
   const avg=[0,0,0];const limit=Math.min(300,colors?.count??0);
   for(let i=0;i<limit;i++){
    avg[0]+=colors.getX(i);avg[1]+=colors.getY(i);avg[2]+=colors.getZ(i);
   }
   if(limit)for(let i=0;i<3;i++)avg[i]/=limit;
   const placements=a.authenticDesertArt?.placements??[];
   return {
    map:a.desertMapId,ready:a.loaded,
    noBrightFoWClouds:!a.atmosphere.showFrontierClouds&&
      a.atmosphere.fogMesh.count===0,
    genuineFogEnabled:a.battlefield.fogEnabled,
    hasRock:!!mesa,
    rockTint:avg,
    cacti:placements.filter(p=>p.kind==='saguaro').length,
    waterLakes:a.desertWater?.layout.lakes.length??0,
    waterRivers:a.desertWater?.layout.rivers.length??0,
    waterMeshes:a.desertWater?.meshes.length??0,
    actual4Deserts:a.game.world.mapVersion>=23,
    collisionCells:a.game.world.blocked.length,
    blackEdge:a.scene.background?.getHexString()==='000000'
   };
  });
  console.log('SANDFORGE_DESERT_VISUAL_REVIEW '+JSON.stringify(report));
  expect(report.ready&&report.actual4Deserts&&report.blackEdge).toBe(true);
  expect(report.noBrightFoWClouds&&report.genuineFogEnabled).toBe(true);
  expect(report.hasRock).toBe(true);
  if(mapId==='broken-empire'){
   expect(report.rockTint[0]).toBeGreaterThan(report.rockTint[1]*1.2);
   expect(report.rockTint[0]).toBeLessThan(.35);
   expect(report.cacti).toBeGreaterThan(0);
   expect(report.waterLakes).toBeGreaterThan(0);
   expect(report.waterMeshes).toBeGreaterThan(0);
  }
  expect(errors).toEqual([]);
  mkdirSync('artifacts/screenshots',{recursive:true});
  await page.screenshot({path:'artifacts/screenshots/'+mapId+'-no-fow-light-halos.png'});
  await page.evaluate(()=>{
   const a=window.__sandforgeWebGL,half=a.game.world.size/2;
   a.battlefield.fogEnabled=false;a.battlefield.updateFog();
   const mesa=a.terrain.mesas[0],p=mesa?.outline?.[0]??a.terrain.sites[0];
   const y=a.heightAt(p.x,p.y);
   a.controls.target.set(p.x-half,y+35,p.y-half);
   a.camera.position.set(p.x-half+310,y+500,p.y-half+335);
   a.camera.zoom=1.8;a.camera.updateProjectionMatrix();a.controls.update();
  });
  await page.waitForTimeout(700);
  await page.screenshot({path:'artifacts/screenshots/'+mapId+'-rock-mountains.png'});
  if(mapId==='broken-empire'){
   await page.evaluate(()=>{
    const a=window.__sandforgeWebGL,half=a.game.world.size/2;
    const lake=a.desertWater.layout.lakes[0];
    const y=a.heightAt(lake.x,lake.y);
    a.controls.target.set(lake.x-half,y,lake.y-half);
    a.camera.position.set(lake.x-half+240,y+400,lake.y-half+270);
    a.camera.zoom=1.75;a.camera.updateProjectionMatrix();a.controls.update();
   });
   await page.waitForTimeout(650);
   await page.screenshot({path:'artifacts/screenshots/broken-empire-no-cacti-in-water.png'});
  }
 });
}
