import * as THREE from 'three';
/** Deterministic real albedo textures; no DOM/canvas/network in Node or WebGL. */
export function servicePaint(palette,{seed=1,pattern='camo',repeat=3,metalness=.18,roughness=.85}={}){
 const swatches=palette.map(hex=>{const n=parseInt(hex.slice(1),16);return [n>>16&255,n>>8&255,n&255]});
 // Detailed, seamlessly tiled 256px concrete / metal / desert surfaces.
 // Periodic large sine blobs made the old concrete look like camouflage.
 // Small stochastic aggregate, discrete expansion joints and a real
 // tangent-space normal map provide detail without scanline-like repetition.
 const side=256,data=new Uint8Array(side*side*4);
 const random=(x,y,salt=0)=>{
  let h=Math.imul(x+seed*37+salt,374761393)^
   Math.imul(y+seed*19+salt*7,668265263);
  h=Math.imul(h^(h>>>13),1274126177);
  return ((h^(h>>>16))>>>0)/4294967295;
 };
 const smooth=(x,y,cell,salt)=>{
  const gx=x/cell,gy=y/cell,i=Math.floor(gx),j=Math.floor(gy);
  const u=gx-i,v=gy-j,fx=u*u*(3-2*u),fy=v*v*(3-2*v);
  const tiles=side/cell;
  const at=(px,py)=>random((px+tiles)%tiles,(py+tiles)%tiles,salt);
  const first=at(i,j)*(1-fx)+at(i+1,j)*fx;
  const second=at(i,j+1)*(1-fx)+at(i+1,j+1)*fx;
  return first*(1-fy)+second*fy;
 };
 for(let y=0;y<side;y++)for(let x=0;x<side;x++){
  const slab=pattern==='slab',asphalt=pattern==='asphalt',
   concrete=pattern==='concrete',metal=pattern==='metal';
  const broad=smooth(x,y,64,13),mid=smooth(x,y,16,29),
   fine=smooth(x,y,8,47),grain=random(x,y,101);
  // Only actual camouflage has broad multi-color splotches. Concrete is
  // poured mineral aggregate, not olive camouflage paint.
  const idx=slab||asphalt?1:
   concrete?1:pattern==='camo'?(broad>.58?2:broad<.42?0:1):
   metal?(mid>.52?1:0):1;
  // Fine grout exists on concrete panel boundaries, not thick painted
  // parallel stripes. Both coordinates tile seamlessly at 256px.
  const joint=slab&&(x%64<2||y%64<2)?-.13:
   concrete&&(x%64===0||y%64===0)?-.065:0;
  const panelShift=slab?(random(Math.floor(x/64),Math.floor(y/64),151)-.5)*.055:0;
  const aggregate=(grain-.5)*(asphalt?.125:metal?.13:.10)+
   (fine-.5)*.085+(mid-.5)*.060+(broad-.5)*.045;
  const smallScratches=metal&&(x%19===0&&grain>.55)?-.055:0;
  const wear=random(x,y,77)>.996?.035:0;
  const scale=1+aggregate+panelShift+joint+smallScratches+wear;
  const p=(y*side+x)*4;
  const swatch=swatches[Math.min(idx,swatches.length-1)];
  for(let k=0;k<3;k++)
   data[p+k]=Math.max(0,Math.min(255,Math.round(swatch[k]*scale)));
  data[p+3]=255;
 }
 const normalData=new Uint8Array(side*side*4);
 const luma=(x,y)=>{
  const i=(((y+side)%side)*side+(x+side)%side)*4;
  return (data[i]*.27+data[i+1]*.60+data[i+2]*.13)/255;
 };
 for(let y=0;y<side;y++)for(let x=0;x<side;x++){
  const dx=(luma(x-1,y)-luma(x+1,y))*.65;
  const dy=(luma(x,y-1)-luma(x,y+1))*.65;
  const inv=1/Math.hypot(dx,dy,1),p=(y*side+x)*4;
  normalData[p]=Math.round(127.5*(1+dx*inv));
  normalData[p+1]=Math.round(127.5*(1+dy*inv));
  normalData[p+2]=Math.round(127.5*(1+inv));
  normalData[p+3]=255;
 }
 const map=new THREE.DataTexture(data,side,side,THREE.RGBAFormat);
 map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(repeat,repeat);
 map.colorSpace=THREE.SRGBColorSpace;map.magFilter=THREE.LinearFilter;
 map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true;
 map.anisotropy=8;map.needsUpdate=true;
 const normalMap=new THREE.DataTexture(normalData,side,side,THREE.RGBAFormat);
 normalMap.wrapS=normalMap.wrapT=THREE.RepeatWrapping;
 normalMap.repeat.set(repeat,repeat);
 normalMap.magFilter=THREE.LinearFilter;
 normalMap.minFilter=THREE.LinearMipmapLinearFilter;
 normalMap.generateMipmaps=true;normalMap.anisotropy=8;normalMap.needsUpdate=true;
 const mat=new THREE.MeshStandardMaterial({color:'#ffffff',map,normalMap,
  normalScale:new THREE.Vector2(.36,.36),metalness,roughness,side:THREE.DoubleSide});
 mat.userData.sandforgeServiceTexture=map;
 mat.userData.sandforgeServiceNormalMap=normalMap;
 return mat;
}
/** A Three.js material.clone() JSON-serializes userData. Storing a live
 * DataTexture there therefore creates a PLAIN OBJECT in the clone, not a
 * disposable GPU texture. That previously crashed clearPlacement() with
 * "map.dispose is not a function" after selecting a factory/airfield ghost,
 * leaving every later building card unable to start placement.
 * Ghosts share their source material.map ONLY until their original owned
 * textures are explicitly disposed, never copy the ownership metadata. */
export function previewServiceMaterial(source,{opacity=.5,color='#a7e4cc'}={}){
 // Source userData holds REAL 256px albedo/normal textures. Three's
 // Material.clone() JSON-copies userData and would serialize both arrays
 // for every ghost (and leak fake texture objects). Strip metadata only for
 // the synchronous clone, then restore it unchanged on the source.
 const metadata=source.userData;
 let clone;
 try{source.userData={};clone=source.clone();}
 finally{source.userData=metadata;}
 clone.color?.lerp(new THREE.Color(color),.14);
 clone.transparent=true;clone.opacity=Math.min(source.opacity??1,opacity);
 // Authored shader-only surfaces (the deep silo liner) explicitly opt in
 // to an opacity uniform. Generic Material.opacity alone does not change
 // ShaderMaterial fragment alpha, leaving an opaque placement ghost.
 if(clone.isShaderMaterial&&clone.uniforms?.uOpacity)
  clone.uniforms.uOpacity.value=clone.opacity;
 clone.depthWrite=false;clone.depthTest=true;
 // Intentionally DO NOT copy source.userData.sandforgeServiceTexture.
 clone.userData={sandforgePreviewMaterial:true,
  sandforgePreviewValidColor:clone.color?.clone(),
  sandforgePreviewInvalidColor:clone.color?.clone().lerp(new THREE.Color('#f1786d'),.66)};
 return clone;
}
export function disposeServicePaint(root){
 const maps=new Set();
 root?.traverse?.(mesh=>{if(!mesh.isMesh)return;
  for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
   // Both PBR maps are allocated per service yard. Release both when the
   // source yard dies; preview clones keep map references but never own them.
   for(const texture of [m?.userData?.sandforgeServiceTexture,
    m?.userData?.sandforgeServiceNormalMap]){
    if(texture?.isTexture&&typeof texture.dispose==='function')maps.add(texture);
   }
  }
 });
 for(const map of maps)map.dispose();
 return maps.size;
}
