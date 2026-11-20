import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
const worlds=['desert-strike','broken-empire','burning-horizon','last-stronghold'];
const expected={
 'desert-strike':{region:'erg',models:[]},
 'broken-empire':{region:'sonoran',models:['saguaro','sandstone']},
 'burning-horizon':{region:'mojave',models:['joshua','sandstone']},
 'last-stronghold':{region:'badlands',models:['sandstone']}
};
for(const id of worlds)test('Actual Chromium 3D: different genuine PBR desert, '+id,async({page})=>{
 test.setTimeout(240000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1600,height:900});
 await page.goto('/webgl-preview.html',{waitUntil:'domcontentloaded'});
 await page.locator('#sf3d-new').click();
 await page.locator('#sf3d-desert-map').selectOption(id);
 await page.locator('#sf3d-new-confirm').click();
 await expect(page).toHaveURL(new RegExp('map='+id));
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:160000});
 await page.waitForFunction(()=>{
  const a=window.__sandforgeWebGL;
  return a?.authenticDesertReady===true&&
   !!a.scene.children.find(x=>x.userData?.terrain)?.material?.userData?.sandforgeGroundPBR;
 },null,{timeout:50000});
 const report=await page.evaluate(()=>{
  const a=window.__sandforgeWebGL,art=a.authenticDesertArt,terrain=a.scene.children.find(x=>x.userData.terrain);
  const meshes=art?.meshes??[];
  return {
   map:a.desertMapId,ecoregion:a.desertRegion,
   stable:!!a.loaded,valid:a.game.world.validation?.valid,
   modelKinds:[...new Set(meshes.map(m=>m.userData.model))].sort(),
   textured:meshes.every(m=>m.isInstancedMesh&&m.material?.map?.isTexture),
   nonBlocking:meshes.every(m=>m.userData.visualOnly&&m.userData.nonBlocking&&m.userData.nonPlayable),
   drawCalls:art?.drawCalls??0,
   triangles:art?.triangles??0,
   placements:art?.placements.length??0,
   missingAssets:art?.failures??[],
   groundPBR:terrain.material.userData.sandforgeGroundPBR,
   source:terrain.material.userData.sandforgeGroundUrl??null,
   groundMaps:Boolean(terrain.material.map?.isTexture&&terrain.material.normalMap?.isTexture&&terrain.material.roughnessMap?.isTexture),
   terrainChunks:a.scene.children.filter(x=>x.userData?.terrain).length,
   hardBlackEdge:a.scene.background.getHexString()==='000000',
   collisionGrid:a.game.world.blocked.length,
   errors
  };
 });
 const want=expected[id];
 expect(report.map).toBe(id);
 expect(report.ecoregion).toBe(want.region);
 expect(report.valid).toBe(true);
 expect(report.hardBlackEdge).toBe(true);
 expect(report.terrainChunks).toBe(16);
 expect(report.groundMaps).toBe(true);
 expect(report.missingAssets).toEqual([]);
 expect(report.modelKinds).toEqual([...want.models].sort());
 expect(report.nonBlocking&&report.textured).toBe(true);
 expect(report.drawCalls).toBeLessThanOrEqual(10);
 if(want.models.length){
  expect(report.drawCalls).toBeGreaterThan(0);
  expect(report.triangles).toBeGreaterThan(2000);
  expect(report.placements).toBeGreaterThan(10);
 }
 if(want.region!=='erg'){
  expect(report.groundPBR).toContain('four-authentic-desert');
  expect(report.source).toContain('desert-'+want.region);
 }
 expect(errors).toEqual([]);
 mkdirSync('artifacts/screenshots',{recursive:true});
 await page.screenshot({path:'artifacts/screenshots/'+id+'-gameplay.png'});
 // Purely for screenshot gallery, never for gameplay: reveal the scenery,
 // suppress HUD, and place camera by REAL generated GLB instance.
 await page.evaluate(()=>{
  const a=window.__sandforgeWebGL;
  for(const el of document.body.children)
   if(el.id!=='stage'&&el.tagName!=='SCRIPT')
    el.style.setProperty('display','none','important');
  a.battlefield.fogEnabled=false;a.battlefield.updateFog();
  const p=a.authenticDesertArt?.placements[0]??a.terrain.sites[0];
  const x=p.x-a.game.world.size/2,z=p.y-a.game.world.size/2,y=a.heightAt(p.x,p.y);
  a.controls.target.set(x,y+30,z);
  a.camera.position.set(x+190,y+200,z+195);
  a.camera.zoom=2.15;a.camera.updateProjectionMatrix();a.controls.update();
 });
 await page.waitForTimeout(900);
 await page.screenshot({path:'artifacts/screenshots/'+id+'-natural-3d-closeup.png'});
 await page.evaluate(()=>{
  const a=window.__sandforgeWebGL;
  const p=a.authenticDesertArt?.placements[0]??a.terrain.sites[0];
  const x=p.x-a.game.world.size/2,z=p.y-a.game.world.size/2,y=a.heightAt(p.x,p.y);
  a.controls.target.set(x,y+20,z);
  a.camera.position.set(x+650,y+1000,z+700);
  a.camera.zoom=1.1;a.camera.updateProjectionMatrix();a.controls.update();
 });
 await page.waitForTimeout(450);
 await page.screenshot({path:'artifacts/screenshots/'+id+'-desert-landscape.png'});
 await page.setViewportSize({width:640,height:360});
 await page.waitForTimeout(360);
 const jpeg=await page.screenshot({type:'jpeg',quality:38});
 console.log('AUTHENTIC_DESERT_THUMBNAIL '+id+' '+jpeg.toString('base64'));
 console.log('AUTHENTIC_DESERT_WEBGL '+JSON.stringify(report));
});
