import {test,expect} from '@playwright/test';

test('actual authored desert settlement: textured ruins and no floating road slabs',async({page})=>{
 test.setTimeout(90000);
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/__sf_authored_village_qa__.html',route=>route.fulfill({
  contentType:'text/html',
  body:'<script type="importmap">{"imports":{"three":"/vendor/three/three.module.js","three/addons/":"/vendor/three/addons/"}}</script><body></body>'
 }));
 await page.goto('/__sf_authored_village_qa__.html');
 const info=await page.evaluate(async()=>{
  const THREE=await import('three');
  const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const {createDesertVillages}=await import('/webgl-desert-village.js');
  const scene=new THREE.Scene(),size=5200,half=size*.5,seed=2988452066;
  const world={size,index:p=>p.x<0||p.y<0||p.x>=size||p.y>=size?-1:0,
   blocked:[false],walkable:()=>true,terrainSlope:()=>0};
  const terrain={sites:[{x:180,y:220}],ruins:[]};
  const heightAt=(x,z)=>Math.sin(x*.012)*2+Math.cos(z*.009)*1.7;
  const pos=(x,z,y=heightAt(x,z))=>new THREE.Vector3(x-half,y,z-half);
  const loader=new GLTFLoader(),cached=new Map();
  const loadModel=url=>{
   if(!cached.has(url))cached.set(url,loader.loadAsync(url));
   return cached.get(url);
  };
  const art=await createDesertVillages({
   scene,world,terrain,pos,heightAt,seed,lowQuality:false,loadModel
  });
  const renderer=new THREE.WebGLRenderer({antialias:false});
  renderer.setSize(160,160);renderer.setPixelRatio(1);
  scene.background=new THREE.Color('#dac5a4');
  scene.add(new THREE.HemisphereLight('#fff8df','#887c69',2));
  const sun=new THREE.DirectionalLight('#fff3d6',1.4);
  sun.position.set(70,140,90);scene.add(sun);
  const center=pos(art.villages[0].x,art.villages[0].y,0);
  const camera=new THREE.PerspectiveCamera(50,1,1,1600);
  camera.position.copy(center).add(new THREE.Vector3(180,170,210));
  camera.lookAt(center);
  renderer.render(scene,camera);
  const glError=renderer.getContext().getError();
  const mats=[...cached.values()];
  const gltfs=await Promise.all(mats);
  let realMeshes=0,materials=0;
  for(const gltf of gltfs)gltf.scene.traverse(part=>{
   if(part.isMesh){realMeshes++;
    materials+=Array.isArray(part.material)?part.material.length:1;
   }
  });
  const colors=art.roads.geometry.getAttribute('color');
  let highestAlpha=0;
  for(let i=0;i<colors.count;i++)
   highestAlpha=Math.max(highestAlpha,colors.getW(i));
  const result={
   villages:art.villages.length,
   buildings:art.villages.reduce((n,v)=>n+v.houses.length,0),
   realMeshes,materials,
   instanced:art.meshes.every(m=>m.isInstancedMesh&&m.count>0),
   oldBoxes:scene.children.some(x=>x.name==='visual-abandoned-adobe-walls'),
   names:art.meshes.map(m=>m.name),
   drawCalls:art.drawCalls,
   roadColorChannels:colors.itemSize,highestAlpha,glError,
   loaded:cached.size
  };
  renderer.dispose();return result;
 });
 expect(info.villages).toBeGreaterThan(0);
 expect(info.buildings).toBeGreaterThanOrEqual(3);
 expect(info.realMeshes).toBeGreaterThan(0);
 expect(info.materials).toBeGreaterThan(0);
 expect(info.instanced).toBe(true);
 expect(info.oldBoxes).toBe(false);
 expect(info.names.every(n=>n.startsWith('visual-authored-abandoned-'))).toBe(true);
 // Each of the two authored ruins contains eight real material primitives.
 // 16 instanced submeshes plus one shared sand-track draw stay constant even
 // when the settlement grows from 3 to 10 authored buildings.
 expect(info.drawCalls).toBeLessThanOrEqual(18);
 expect(info.loaded).toBe(2);
 expect(info.roadColorChannels).toBe(4);
 expect(info.highestAlpha).toBeLessThanOrEqual(.26);
 expect(info.glError).toBe(0);
 expect(errors).toEqual([]);
});
