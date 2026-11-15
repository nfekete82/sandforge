import {test,expect} from '@playwright/test';

test('live Sandforge loads the new soldier and plays actual skeletal actions',async({page})=>{
 test.setTimeout(120000);
 const failures=[];
 page.on('pageerror',error=>failures.push(String(error)));
 await page.goto('/webgl-preview.html?seed=2074&lite=1&play=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,{timeout:95000});
 const result=await page.evaluate(async()=>{
  const runtime=window.__sandforgeWebGL;
  const THREE=await import('/vendor/three/three.module.js');
  const {clone}=await import('/vendor/three/addons/utils/SkeletonUtils.js');
  const {prepareLowpolySoldier}=await import('/webgl-lowpoly-soldier.js');
  const battlefield=runtime.battlefield;
  const route0=battlefield.asset('infantry',0,'unit');
  const route1=battlefield.asset('infantry',1,'unit');
  const data=await battlefield.getModel(route0);
  const blue=clone(data.scene);
  const red=clone(data.scene);
  prepareLowpolySoldier(blue,0);
  prepareLowpolySoldier(red,1);
  const walk=data.animations.find(a=>a.name==='Walk');
  const bones=[];
  blue.traverse(node=>{if(node.isBone)bones.push(node);});
  const q0=bones.map(b=>b.quaternion.toArray());
  const mixer=new THREE.AnimationMixer(blue);
  mixer.clipAction(walk).play();
  mixer.update(.24);
  const q1=bones.map(b=>b.quaternion.toArray());
  const movedBones=q0.filter((q,i)=>q.some((v,j)=>Math.abs(v-q1[i][j])>.0001)).length;
  let redTints=0,meshCount=0,skinned=0;
  red.traverse(node=>{
   if(!node.isMesh)return;
   meshCount++;
   if(node.isSkinnedMesh)skinned++;
   const mats=Array.isArray(node.material)?node.material:[node.material];
   if(mats.some(m=>m?.userData?.sandforgeLowpolySoldierRed))redTints++;
  });
  // Cross-check the real WebGL renderer sees the same skinned actor it loads.
  const actor=new THREE.Group();
  actor.name='SandforgeLowPolyBrowserTestActor';
  actor.scale.setScalar(80);
  actor.position.copy(runtime.controls.target);
  actor.add(blue);
  runtime.scene.add(actor);
  await new Promise(resolve=>requestAnimationFrame(resolve));
  const drawCalls=runtime.renderer.info.render.calls;
  runtime.scene.remove(actor);
  mixer.stopAllAction();
  return {
   route0,route1,clips:data.animations.map(a=>a.name),
   bones:blue.getObjectByName('SandforgeSoldierRig')?.children?.length??null,
   boneCount:bones.length,movedBones,
   redTints,meshCount,skinned,drawCalls,
   blueAuthored:blue.userData.sandforgePreserveAuthoredMaterials,
   hasMuzzle:Boolean(blue.getObjectByName('WeaponMuzzle'))
  };
 });
 expect(result.route0).toBe('/src/assets/meshy/infantry-animated.glb');
 expect(result.route1).toBe(result.route0);
 for(const clip of ['Idle','Walk','Run','Attack','Hit','Death'])expect(result.clips).toContain(clip);
 expect(result.boneCount).toBeGreaterThanOrEqual(18);
 expect(result.movedBones).toBeGreaterThan(0);
 expect(result.skinned).toBeGreaterThan(0);
 expect(result.redTints).toBeGreaterThan(0);
 expect(result.meshCount).toBeGreaterThan(0);
 expect(result.blueAuthored).toBeTruthy();
 expect(result.hasMuzzle).toBeTruthy();
 expect(result.drawCalls).toBeGreaterThan(0);
 expect(failures).toEqual([]);
});
