import {test,expect} from '@playwright/test';

test('real Nov 11 pioneer switches hand from pistol to wrench, then can defend',async({page})=>{
 test.setTimeout(120000);
 const errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 await page.goto('/webgl-preview.html?seed=2074&bastions=4&play=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:95000});
 const data=await page.evaluate(async()=>{
  const runtime=window.__sandforgeWebGL;
  const {clone}=await import('/vendor/three/addons/utils/SkeletonUtils.js');
  const {equipEngineerTools,updateEngineerTools}=await import('/webgl-engineer-tools.js');
  const result=[];
  for(const owner of [0,1]){
   const asset=await runtime.battlefield.getModel('/src/assets/reborn/prototype/engineer-'+owner+'.glb');
   const model=clone(asset.scene);
   const tools=equipEngineerTools(model);
   const socket=model.getObjectByName('Atlas_WeaponSocket');
   const before={
    pistol:tools.pistol?.visible,
    wrench:tools.wrench?.visible,
    attached:tools.wrench?.parent===socket,
    hasPistolMesh:Boolean(model.getObjectByName('Atlas_PistolSlide')),
    hasWrenchMesh:Boolean(tools.wrench?.getObjectByName('Repair_Wrench_Steel')),
   };
   updateEngineerTools(tools,true,.4);
   const repair={pistol:tools.pistol?.visible,wrench:tools.wrench?.visible,
    rotated:tools.wrench.rotation.z!==tools.wrench.userData.restRotationZ};
   updateEngineerTools(tools,false,.8);
   const defense={pistol:tools.pistol?.visible,wrench:tools.wrench?.visible};
   const animation=new (await import('/vendor/three/three.module.js')).AnimationMixer(model);
   const walk=asset.animations.find(a=>a.name==='Run_Gun');
   animation.clipAction(walk).play();
   animation.update(.2);
   const stable=tools.wrench.parent===socket;
   const actor=new (await import('/vendor/three/three.module.js')).Group();
   actor.add(model);
   runtime.scene.add(actor);
   runtime.renderer.render(runtime.scene,runtime.camera);
   const drawCalls=runtime.renderer.info.render.calls;
   runtime.scene.remove(actor);
   result.push({owner,before,repair,defense,stable,drawCalls,clip:walk?.name});
  }
  const catalog=await import('/src/reborn/catalog.js');
  return {models:result,hq:catalog.BUILDINGS.headquarters.name,
   pistolDamage:catalog.UNITS.engineer.damage,pistolRange:catalog.UNITS.engineer.range};
 });
 expect(data.hq).toBe('Kommandozentrale');
 expect(data.pistolDamage).toBe(8);
 expect(data.pistolRange).toBe(145);
 for(const m of data.models){
  expect(m.before).toEqual({pistol:true,wrench:false,attached:true,hasPistolMesh:true,hasWrenchMesh:true});
  expect(m.repair).toEqual({pistol:false,wrench:true,rotated:true});
  expect(m.defense).toEqual({pistol:true,wrench:false});
  expect(m.stable).toBeTruthy();
  expect(m.clip).toBe('Run_Gun');
  expect(m.drawCalls).toBeGreaterThan(0);
 }
 expect(errors).toEqual([]);
});
