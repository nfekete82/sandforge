import {test,expect} from '@playwright/test';

test('single-storey low-poly HQ keeps desert camouflage textures fixed when moving the building',async({page})=>{
 test.setTimeout(90000);
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/glb-quality.html',{waitUntil:'domcontentloaded'});
 const result=await page.evaluate(async()=>{
  const THREE=await import('three');
  const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const {applyStrategicGlbFinish}=await import('/webgl-strategic-glb.js');
  const {scene:group}=await new GLTFLoader().loadAsync(
   '/src/assets/reborn/buildings-3d/sandforge_feldkommando_lowpoly_1geschoss.glb');
  applyStrategicGlbFinish(group);
  const nodes=['Gate_Left_Pivot','Gate_Right_Pivot','Radar_Pivot',
   'TeamBanner_Left','TeamBanner_Right'].map(name=>Boolean(group.getObjectByName(name)));
  let textures=0,customCamo=0,atlas=0,missingUV=0;
  group.traverse(node=>{
   if(!node.isMesh)return;
   for(const material of Array.isArray(node.material)?node.material:[node.material]){
    if(material?.map){
     textures++;
     if(material.map.name?.startsWith('SF_HQ_'))atlas++;
     if(!node.geometry.getAttribute('uv'))missingUV++;
    }
    if(material?.userData?.sandforgeFinalCamo)customCamo++;
   }
  });
  const scene=new THREE.Scene();
  scene.background=new THREE.Color('#202020');
  scene.add(group);
  scene.add(new THREE.AmbientLight('#ffffff',2.2));
  const light=new THREE.DirectionalLight('#ffffff',2);
  scene.add(light);scene.add(light.target);
  const camera=new THREE.PerspectiveCamera(44,1,.05,150);
  const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});
  renderer.setPixelRatio(1);renderer.setSize(280,280,false);
  const buffer=new THREE.WebGLRenderTarget(280,280,{depthBuffer:true});
  const renderAt=x=>{
   group.position.set(x,0,0);
   camera.position.set(x+20,13,21);
   camera.lookAt(x,3,0);
   light.position.set(x+2,11,8);light.target.position.set(x,2,0);
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
   textures,customCamo,atlas,missingUV,nodes};
 });
 expect(errors).toEqual([]);
 expect(result.nodes.every(Boolean)).toBe(true);
 expect(result.subjects).toBeGreaterThan(1000);
 expect(result.textures).toBeGreaterThan(7);
 expect(result.atlas).toBeGreaterThan(7);
 expect(result.missingUV).toBe(0);
 expect(result.customCamo).toBe(0);
 expect(result.pixelDifference).toBeLessThan(.025);
});
