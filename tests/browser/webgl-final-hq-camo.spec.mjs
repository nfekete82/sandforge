import {test,expect} from '@playwright/test';

test('Feldkommando camouflage remains painted to the model when its world position changes',async({page})=>{
 test.setTimeout(90000);
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/glb-quality.html',{waitUntil:'domcontentloaded'});
 const result=await page.evaluate(async()=>{
  const THREE=await import('three');
  const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const {applyStrategicGlbFinish}=await import('/webgl-strategic-glb.js');
  const gltf=await new GLTFLoader().loadAsync(
   '/src/assets/reborn/buildings-3d/sandforge_feldkommando_final.glb');
  const group=gltf.scene;
  applyStrategicGlbFinish(group);
  const body=group.getObjectByName('SF_Final_Static_Body');
  if(!body?.material?.userData?.sandforgeFinalCamo)
   throw Error('Final HQ camouflage material is missing');
  const scene=new THREE.Scene();
  scene.background=new THREE.Color('#202020');
  scene.add(group);
  scene.add(new THREE.AmbientLight('#ffffff',2.2));
  const light=new THREE.DirectionalLight('#ffffff',2);
  light.position.set(2,3,4);scene.add(light);scene.add(light.target);
  const camera=new THREE.PerspectiveCamera(44,1,.05,100);
  const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});
  renderer.setPixelRatio(1);renderer.setSize(280,280,false);
  const buffer=new THREE.WebGLRenderTarget(280,280,{depthBuffer:true});
  const renderAt=x=>{
   group.position.set(x,0,0);
   camera.position.set(x+1.42,.84,1.62);
   camera.lookAt(x,0,0);
   light.position.set(x+2,3,4);
   light.target.position.set(x,0,0);
   group.updateMatrixWorld(true);
   renderer.setRenderTarget(buffer);renderer.render(scene,camera);
   const data=new Uint8Array(280*280*4);
   renderer.readRenderTargetPixels(buffer,0,0,280,280,data);
   return data;
  };
  const before=renderAt(0),after=renderAt(17);
  let difference=0,subjects=0;
  for(let i=0;i<before.length;i+=4){
   const total=before[i]+before[i+1]+before[i+2];
   if(total<150)continue;
   subjects++;
   difference+=Math.abs(before[i]-after[i])+
    Math.abs(before[i+1]-after[i+1])+Math.abs(before[i+2]-after[i+2]);
  }
  buffer.dispose();renderer.dispose();
  return {pixelDifference:subjects?difference/(subjects*3*255):1,subjects,
   textureWidth:body.material.map?.image?.width||null,
   shaderRevision:body.material.customProgramCacheKey()};
 });
 expect(errors).toEqual([]);
 expect(result.subjects).toBeGreaterThan(1000);
 expect(result.textureWidth).toBeGreaterThan(1000);
 expect(result.shaderRevision).toContain('local-desert-v4');
 // A world-projected texture would visibly change even though the
 // camera/light follow the model. Model-local texture must remain identical.
 expect(result.pixelDifference).toBeLessThan(.025);
});
