import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';

test('real Chromium WebGL: detailed fortified bunkers and distinct animated flags',async({page})=>{
 test.setTimeout(240000);
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{
  if(m.type()==='error'&&/WebGLProgram|shader|VALIDATE_STATUS|THREE\.WebGL/i.test(m.text()))
   errors.push(m.text());
 });
 await page.setViewportSize({width:1600,height:900});
 await page.goto('/webgl-preview.html',{waitUntil:'domcontentloaded'});
 await page.locator('#sf3d-new').click();
 await page.locator('#sf3d-desert-map').selectOption('broken-empire');
 await page.locator('#sf3d-new-confirm').click();
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:170000});
 const report=await page.evaluate(async()=>{
  const a=window.__sandforgeWebGL;
  const {createFortifiedBunker,updateBunkerFlagWind}=await import('/webgl-fortified-bunker.js');
  a.battlefield.fogEnabled=false;a.battlefield.updateFog();
  const half=a.game.world.size/2;
  const y=a.heightAt(half,half);
  const blue=createFortifiedBunker(0),red=createFortifiedBunker(1);
  blue.position.set(-135,y+2,0);red.position.set(135,y+2,0);
  a.scene.add(blue,red);
  updateBunkerFlagWind(4.7);
  a.controls.target.set(0,y+36,0);
  a.camera.position.set(325,y+260,440);
  a.camera.zoom=1.30;a.camera.updateProjectionMatrix();a.controls.update();
  const materials=root=>{
   const unique=new Set();
   root.traverse(m=>{if(m.isMesh)unique.add(m.material);});
   return [...unique];
  };
  return {
   colors:[blue.getObjectByName('Bunker_BlueFactionFlag')?.material.map?.name,
    red.getObjectByName('Bunker_RedFactionFlag')?.material.map?.name],
   ports:[blue,red].map(root=>root.children.filter(m=>
    /^Bunker_Embrasure_\d+$/.test(m.name)).length),
   batchedDraws:[blue.userData.bunkerDrawCalls,red.userData.bunkerDrawCalls],
   genuine512:[blue,red].every(root=>materials(root).some(m=>
    m.name==='Bunker cast concrete PBR'&&m.map?.image.width===512&&
    m.normalMap?.image.width===512&&m.roughnessMap?.image.width===512)),
   teamFlags:[blue,red].every(root=>root.children.some(m=>m.userData.bunkerFlag))
  };
 });
 console.log('SANDFORGE_FORTIFIED_BUNKERS '+JSON.stringify(report));
 expect(report.ports).toEqual([5,5]);
 expect(report.batchedDraws.every(v=>v<=22)).toBe(true);
 expect(report.genuine512&&report.teamFlags).toBe(true);
 await page.waitForTimeout(1000);
 mkdirSync('artifacts/screenshots',{recursive:true});
 await page.screenshot({path:'artifacts/screenshots/fortified-bunker-blue-red-real-pbr.png'});
 expect(errors).toEqual([]);
});
