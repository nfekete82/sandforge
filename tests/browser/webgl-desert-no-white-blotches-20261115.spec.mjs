import {test,expect} from '@playwright/test';

test('modern 4-bastion desert renders real seamless albedo/normal/roughness PBR without white blotches',async({page})=>{
 test.setTimeout(150000);
 const errors=[],oldArtwork=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('request',request=>{
  if(request.url().includes('sand-ripples-v2.png'))oldArtwork.push(request.url());
 });
 await page.goto('/?bastions=4&seed=2988452066&play=1&terrain=random&biome=desert&pause=1',{
  waitUntil:'domcontentloaded'
 });
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded,null,{timeout:120000});
 await page.waitForFunction(()=>{
  const gl=window.__sandforgeWebGL;
  const ground=gl?.scene?.children?.find(item=>item.userData?.terrain);
  return ground?.material?.userData?.sandforgeSandPBR==='authored-wind-sand-v1-20261115';
 },null,{timeout:60000});
 const state=await page.evaluate(()=>{
  const gl=window.__sandforgeWebGL;
  const ground=gl.scene.children.filter(item=>item.userData?.terrain);
  if(ground.length!==16)throw Error('expected 4x4 terrain chunks');
  const mat=ground[0].material;
  const image=mat.map?.image;
  const canvas=document.createElement('canvas');
  canvas.width=image.width;canvas.height=image.height;
  canvas.getContext('2d',{willReadFrequently:true}).drawImage(image,0,0);
  const {data}=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height);
  let bright=0,minR=255,maxR=0,maxG=0,maxB=0,edgeDelta=0;
  const w=canvas.width,h=canvas.height;
  for(let k=0;k<data.length;k+=4){
   const r=data[k],g=data[k+1],b=data[k+2];
   if(r>244&&g>240&&b>235)bright++;
   minR=Math.min(minR,r);maxR=Math.max(maxR,r);
   maxG=Math.max(maxG,g);maxB=Math.max(maxB,b);
  }
  for(let i=0;i<w;i++){
   for(let c=0;c<3;c++){
    edgeDelta+=Math.abs(data[i*4+c]-data[((h-1)*w+i)*4+c]);
    edgeDelta+=Math.abs(data[(i*w)*4+c]-data[((i+1)*w-1)*4+c]);
   }
  }
  return {
   chunks:ground.length, sourceSize:[w,h],
   normalSize:[mat.normalMap.image.width,mat.normalMap.image.height],
   roughnessSize:[mat.roughnessMap.image.width,mat.roughnessMap.image.height],
   revision:mat.userData.sandforgeSandPBR,
   source:mat.userData.sandforgeSandPBRUrl,
   mapColorSpace:mat.map.colorSpace,
   normalColorSpace:mat.normalMap.colorSpace,
   roughnessColorSpace:mat.roughnessMap.colorSpace,
   roughness:mat.roughness,metalness:mat.metalness,
   materialColor:mat.color.getHexString(),
   normalScale:[mat.normalScale.x,mat.normalScale.y],
   bright,minR,maxR,maxG,maxB,
   edgeMeanDifference:edgeDelta/(6*w),
   shared:ground.every(mesh=>mesh.material===mat),
   mapWrap:[mat.map.wrapS,mat.normalMap.wrapS,mat.roughnessMap.wrapS],
   modern:!!gl.terrain.battlefield
  };
 });
 expect(state.modern).toBe(true);
 expect(state.chunks).toBe(16);
 expect(state.shared).toBe(true);
 expect(state.revision).toBe('authored-wind-sand-v1-20261115');
 expect(state.source).toBe('/src/assets/reborn/terrain/sand-wind-albedo-v1.webp');
 expect(state.sourceSize).toEqual([512,512]);
 expect(state.normalSize).toEqual([1024,1024]);
 expect(state.roughnessSize).toEqual([1024,1024]);
 expect(state.bright).toBe(0);
 expect(state.maxR).toBeLessThan(245);
 expect(state.maxB).toBeLessThan(state.maxG);
 expect(state.maxG).toBeLessThan(state.maxR);
 expect(state.edgeMeanDifference).toBeLessThan(8);
 expect(state.roughness).toBe(1);
 expect(state.metalness).toBe(0);
 expect(state.normalScale).toEqual([.6,.6]);
 expect(state.materialColor).toBe('ffffff');
 expect(new Set(state.mapWrap).size).toBe(1);
 expect(oldArtwork).toEqual([]);
 expect(errors).toEqual([]);
});
