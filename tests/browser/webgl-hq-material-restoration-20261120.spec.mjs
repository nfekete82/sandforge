import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';

test('actual HQ GLB retains original normal maps and true PBR color in Three.js',async({page})=>{
 test.setTimeout(240000);
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{
  if(m.type()==='error'&&/WebGLProgram|Shader Error|VALIDATE_STATUS/i.test(m.text()))
   errors.push(m.text());
 });
 await page.setViewportSize({width:1600,height:900});
 await page.goto('/webgl-preview.html',{waitUntil:'domcontentloaded'});
 await page.locator('#sf3d-new').click();
 await page.locator('#sf3d-desert-map').selectOption('broken-empire');
 await page.locator('#sf3d-new-confirm').click();
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:165000});
 const info=await page.evaluate(async()=>{
  const THREE=await import('three');
  const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const {enhanceMilitaryMicroPBR}=await import('/webgl-military-micro-pbr.js');
  const {scene,controls,camera,game,heightAt,battlefield}=window.__sandforgeWebGL;
  const hq=(await new GLTFLoader().loadAsync('/src/assets/reborn/buildings-3d/headquarters-0.glb')).scene;
  const original=hq.getObjectByName('HQ_Static_SF_OriginalPBR_walls');
  if(!original)return {error:'authored HQ facade mesh missing'};
  const all=()=>{const meshes=[];hq.traverse(m=>{if(m.isMesh)meshes.push(m);});return meshes};
  const mat0=all().map(m=>m.material);
  const mappedBefore=mat0.filter(m=>m.map?.isTexture).length;
  const normalsBefore=mat0.filter(m=>m.normalMap?.isTexture).length;
  const result=enhanceMilitaryMicroPBR(hq,{kind:'headquarters',type:'building'});
  const unchanged=all().every((m,i)=>m.material===mat0[i]);
  // Additional model is only shown in the QA viewer, not built or granted
  // in any saved Sandforge battle. Test game saves remain unaffected.
  const world=game.world,half=world.size/2;
  const x=world.size*.43,z=world.size*.46,y=heightAt(x,z);
  const bounds=new THREE.Box3().setFromObject(hq);
  const dims=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const scale=205/Math.max(dims.x,dims.z);
  hq.scale.setScalar(scale);
  hq.position.set(x-half-center.x*scale,y-bounds.min.y*scale,z-half-center.z*scale);
  scene.add(hq);
  battlefield.fogEnabled=false;battlefield.updateFog();
  controls.target.set(x-half,y+84,z-half);
  camera.position.set(x-half+330,y+390,z-half+450);
  camera.zoom=1.5;camera.updateProjectionMatrix();controls.update();
  return {
   originalMesh:original.name,
   sourceMaterials:mat0.length,
   existingAlbedoMaps:mappedBefore,
   existingNormalMaps:normalsBefore,
   microShaderAdditions:result.materials,
   originalShaderMaterialsUntouched:unchanged,
   restoredWallsUsePBR:Boolean(original.material?.map?.isTexture),
   noChangesToGame:true
  };
 });
 console.log('HQ_ORIGINAL_PBR_VISUAL '+JSON.stringify(info));
 expect(info.error).toBeUndefined();
 expect(info.microShaderAdditions).toBe(0);
 expect(info.originalShaderMaterialsUntouched).toBe(true);
 expect(info.existingAlbedoMaps).toBeGreaterThan(0);
 expect(info.existingNormalMaps).toBeGreaterThan(0);
 expect(info.restoredWallsUsePBR).toBe(true);
 await page.waitForTimeout(900);
 mkdirSync('artifacts/screenshots',{recursive:true});
 await page.screenshot({path:'artifacts/screenshots/hq-original-pbr-facade-restored.png'});
 expect(errors).toEqual([]);
});
