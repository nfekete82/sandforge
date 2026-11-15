import {test,expect} from '@playwright/test';

test('4-bastion desert uses warm matte sand canvas without painted white patches',async({page})=>{
 test.setTimeout(150000);
 const errors=[],artworkRequests=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('request',request=>{
  if(request.url().includes('sand-ripples-v2.png'))artworkRequests.push(request.url());
 });
 await page.goto('/?bastions=4&seed=2988452066&play=1&terrain=random&biome=desert&pause=1',{
  waitUntil:'domcontentloaded'
 });
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded,null,{timeout:120000});
 const result=await page.evaluate(()=>{
  const gl=window.__sandforgeWebGL;
  const ground=gl.scene.children.filter(item=>item.userData?.terrain);
  if(ground.length!==16)throw Error('expected 4x4 ground tiles, found '+ground.length);
  const mat=ground[0].material;
  const texture=mat.map;
  const image=texture?.image;
  if(!image||!image.getContext)throw Error('ground map is not a generated matte canvas');
  const ctx=image.getContext('2d',{willReadFrequently:true});
  const {data,width,height}=ctx.getImageData(0,0,image.width,image.height);
  let bright=0,maxR=0,maxG=0,maxB=0,avgR=0,avgG=0,avgB=0;
  for(let k=0;k<data.length;k+=4){
   const r=data[k],g=data[k+1],b=data[k+2];
   if(r>244&&g>240&&b>235)bright++;
   maxR=Math.max(maxR,r);maxG=Math.max(maxG,g);maxB=Math.max(maxB,b);
   avgR+=r;avgG+=g;avgB+=b;
  }
  const pixels=data.length/4;
  return {
   chunks:ground.length,textureSize:[width,height],
   actualColor:'#'+mat.color.getHexString(),
   bright,maxR,maxG,maxB,
   mean:[avgR/pixels,avgG/pixels,avgB/pixels],
   groundTexturesShared:ground.every(mesh=>mesh.material===mat),
   modernMap:!!gl.terrain.battlefield
  };
 });
 expect(result.modernMap).toBe(true);
 expect(result.chunks).toBe(16);
 expect(result.textureSize).toEqual([256,256]);
 expect(result.actualColor).toBe('#f2e1c7');
 expect(result.bright).toBe(0);
 expect(result.maxR).toBeLessThan(245);
 expect(result.mean[0]).toBeGreaterThan(result.mean[1]);
 expect(result.mean[1]).toBeGreaterThan(result.mean[2]);
 expect(result.groundTexturesShared).toBe(true);
 expect(artworkRequests).toEqual([]);
 expect(errors).toEqual([]);
});
