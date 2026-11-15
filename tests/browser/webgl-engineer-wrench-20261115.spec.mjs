import {test,expect} from '@playwright/test';

test('Kommandozentrale label and actual unarmed pioneer wrench both factions',async({page})=>{
 test.setTimeout(120000);
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('/webgl-preview.html?seed=2074&bastions=4&play=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:95000});
 const details=await page.evaluate(async()=>{
  const runtime=window.__sandforgeWebGL;
  const {clone}=await import('/vendor/three/addons/utils/SkeletonUtils.js');
  const {equipEngineerWrench,updateEngineerWrench}=await import('/webgl-engineer-wrench.js');
  const THREE=await import('/vendor/three/three.module.js');
  const summary=[];
  for(const owner of [0,1]){
   const gltf=await runtime.battlefield.getModel('/src/assets/reborn/prototype/engineer-'+owner+'.glb');
   const model=clone(gltf.scene);
   const wrench=equipEngineerWrench(model);
   const bone=model.getObjectByName('Atlas_WeaponSocket');
   const originalRotation=wrench.rotation.z;
   updateEngineerWrench(wrench,true,.15);
   const duringRepair=wrench.rotation.z;
   updateEngineerWrench(wrench,false,0);
   const animation=new THREE.AnimationMixer(model);
   const run=gltf.animations.find(x=>x.name==='Run_Gun')??gltf.animations.find(x=>x.name==='Idle');
   animation.clipAction(run).play();
   animation.update(.2);
   const actor=new THREE.Group();
   actor.name='WrenchQA';
   actor.add(model);
   runtime.scene.add(actor);
   runtime.renderer.render(runtime.scene,runtime.camera);
   const meshes=[];wrench.traverse(x=>{if(x.isMesh)meshes.push(x.name);});
   summary.push({
    owner,hasSocket:Boolean(bone),followed:Boolean(wrench.parent===bone),
    meshNames:meshes,
    pistolHidden:model.getObjectByName('Pistol')?.visible===false,
    shotgunHidden:model.getObjectByName('Shotgun')?.visible===false,
    rifleHidden:model.getObjectByName('Atlas_Rifle')?.visible===false,
    movedDuringRepair:duringRepair!==originalRotation,
    animationExists:!!run,
    handAttachedAfterAnimation:wrench.parent===bone,
    drawCalls:runtime.renderer.info.render.calls
   });
   runtime.scene.remove(actor);
  }
  return {details:summary,title:(await import('/src/reborn/catalog.js')).BUILDINGS.headquarters.name};
 });
 expect(details.title).toBe('Kommandozentrale');
 for(const e of details.details){
  expect(e.hasSocket).toBeTruthy();
  expect(e.followed).toBeTruthy();
  expect(e.pistolHidden&&e.shotgunHidden&&e.rifleHidden).toBeTruthy();
  expect(e.meshNames).toEqual(expect.arrayContaining(['Repair_Wrench_Steel','Repair_Wrench_Grip']));
  expect(e.movedDuringRepair).toBeTruthy();
  expect(e.animationExists).toBeTruthy();
  expect(e.handAttachedAfterAnimation).toBeTruthy();
  expect(e.drawCalls).toBeGreaterThan(0);
 }
 expect(errors).toEqual([]);
});
