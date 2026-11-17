import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {createStrategicBuilding,isStrategicBuilding,prepareSiloForPortrait} from './webgl-strategic-buildings.js';
import {createRocketInfantry,attachRocketLauncherToInfantry} from './webgl-rocket-infantry.js';
import {createResearchArtwork,RESEARCH_ARTWORK_KINDS} from './webgl-research-artworks.js';
import {tintFactionMaterials} from './webgl-faction-accents.js';
import {finishBarracksSides,finishBarracksDesertPalette} from './webgl-barracks-shell.js';
import {finishBuildingFacadeShading} from './webgl-building-shading.js';
import {finishDesertBuildingMaterials,waitForDesertBuildingTextures,DESERT_BUILDING_KINDS} from './webgl-building-pbr.js';
import {hasAuthoredHeadquartersPBR,prepareAuthoredHeadquartersPortrait} from './webgl-hq-portrait.js';
import {hasFinalBarracksPBR,prepareFinalBarracksPortrait} from './webgl-pbr-barracks-portrait.js';
import {polishBarracksProps} from './webgl-barracks-props.js';
import {paintFactionRoofStripes} from './webgl-building-roof-stripes.js';
import {paintFactionEntranceBanners} from './webgl-entrance-banners.js';
import {customSupplyTruckUrl,prepareCustomSupplyTruck,isCustomSupplyTruck} from './webgl-supply-custom.js';

/** Sprite-sheet portrait extraction shared by the WebGL HUD.
 * The classic game crops one idle frame rather than scaling down the entire
 * 8/16-direction animation atlas (which looks like tiny dots). */
const iconCache=new Map();
const folders=kind=>['infantry','engineer','medic','heavy'].includes(kind)?'prototype':'animation';
export const unitAtlasUrl=kind=>'/src/assets/reborn/'+folders(kind)+'/'+kind+'-0';
/** Local original vector icons for the new strategic facilities; existing
 * buildings retain their authored PNGs. No missing-file fetches or tracking. */
export const strategicBuildingIcon=kind=>{
 if(kind==='wall'){
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 190">'+
   '<rect width="192" height="190" rx="13" fill="#222a2a"/>'+
   '<path d="M14 140 L35 115 L158 115 L177 140 L177 162 L14 162Z" fill="#656456"/>'+
   '<path d="M21 70 H171 V133 H21Z" fill="#c9b994" stroke="#6e6a58" stroke-width="5"/>'+
   '<path d="M24 73 H66 L77 89 L65 104 H25Z" fill="#a69a78"/>'+
   '<path d="M91 73 H149 L162 89 L141 111 H109 L88 95Z" fill="#82866d"/>'+
   '<path d="M37 107 L91 97 L115 127 H33Z" fill="#ac9671"/>'+
   '<path d="M138 112 L169 98 V130 H127Z" fill="#8f9477"/>'+
   '<path d="M71 73 V135 M121 73 V135" stroke="#827966" stroke-width="4"/>'+
   '<path d="M18 69 H174 V79 H18Z" fill="#3c819e"/>'+
   '<path d="M21 102 H171" stroke="#a3997b" stroke-width="3"/>'+
   '<rect x="12" y="60" width="14" height="84" fill="#777665"/>'+
   '<rect x="166" y="60" width="14" height="84" fill="#777665"/>'+
   '</svg>';
  return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg);
 }
 if(!['research','silo','interceptor'].includes(kind))return null;
 const pict=kind==='research'?
  '<rect x="40" y="65" width="112" height="86" rx="6" fill="#a9997c"/>'+
  '<rect x="44" y="74" width="103" height="57" fill="#4a5860"/>'+
  '<path d="M95 79 L95 38 M65 56 Q95 8 125 56Z" fill="#6499a7" stroke="#e8c58a" stroke-width="6"/>'+
  '<circle cx="95" cy="35" r="9" fill="#e5c98b"/>':
  kind==='silo'?
  // Match the playable SILO rather than the retired upright bunker icon:
  // low dark deck, broad circular recessed steel hatch, smooth parked missile,
  // and a compact desert service room to its right.
  '<path d="M13 120 L88 82 L179 123 L102 166 Z" fill="#323834" stroke="#7c755d" stroke-width="3"/>'+
  '<path d="M35 120 L91 94 L158 123 L100 151 Z" fill="#181f21" stroke="#6c7166" stroke-width="6"/>'+
  '<ellipse cx="96" cy="124" rx="47" ry="24" fill="#263138" stroke="#87928c" stroke-width="4"/>'+
  '<ellipse cx="96" cy="121" rx="38" ry="19" fill="#141d22"/>'+
  '<path d="M88 100 L88 79 Q89 68 96 64 Q105 69 105 79 L105 101Z" fill="#8e9998"/>'+
  '<path d="M88 100 L88 126 Q96 137 105 126 L105 100Z" fill="#8e9998"/>'+
  '<path d="M88 92 Q96 82 105 92" stroke="#d4dbd6" stroke-width="2" fill="none"/>'+
  '<path d="M129 120 L159 105 L175 113 L146 128 Z" fill="#a69b79"/>'+
  '<path d="M129 120 L146 128 L146 142 L129 134Z" fill="#877e63"/>'+
  '<path d="M146 128 L175 113 L175 127 L146 142Z" fill="#666a56"/>'+
  '<rect x="151" y="125" width="10" height="9" fill="#212b30"/>'+
  '<path d="M26 139 L44 150 M157 151 L173 142" stroke="#857b61" stroke-width="3"/>':
  '<rect x="30" y="110" width="132" height="52" rx="8" fill="#877b66"/>'+
  '<rect x="48" y="63" width="98" height="60" rx="8" fill="#4c6064"/>'+
  '<path d="M60 118 L71 59 L87 33 L92 103 M104 118 L115 59 L131 33 L136 103" stroke="#d1d2bd" stroke-width="17" stroke-linecap="round" fill="none"/>'+
  '<circle cx="39" cy="95" r="14" fill="#7eb8bf" stroke="#ddc591" stroke-width="4"/>';
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="192" height="190" viewBox="0 0 192 190">'+
  '<rect x="8" y="8" width="176" height="174" rx="13" fill="#222a2a"/>'+
  '<ellipse cx="97" cy="160" rx="81" ry="17" fill="#665747"/>'+pict+
  '<rect x="18" y="168" width="156" height="4" rx="2" fill="#ba9a64"/>'+
  '</svg>';
 return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg);
};
export const buildingIconUrl=kind=>strategicBuildingIcon(kind)??
 '/src/assets/reborn/buildings-3d/'+kind+'-0.png';


/** Recognizable, original tactical pictograms; no font-dependent emoji/glyphs. */
const researchPaths=Object.freeze({
 armor1:'<path d="M12 2 4 5v6c0 5 3.3 8.6 8 11 4.7-2.4 8-6 8-11V5Z"/><path d="M8 12h8"/>',
 armor2:'<path d="M12 2 4 5v6c0 5 3.3 8.6 8 11 4.7-2.4 8-6 8-11V5Z"/><path d="M12 7v10M7 12h10"/><path d="M7 4 5 7m12-3 2 3"/>',
 precision:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v5m0 12v5M1 12h5m12 0h5"/>',
 engines:'<circle cx="8" cy="14" r="5"/><circle cx="8" cy="14" r="2"/><path d="m13 6 4-3m-2 7 7-4m-6 10 6-2M3 5l3 3"/>',
 infantryTraining:'<path d="M4 12a8 8 0 0 1 16 0v2H4Z"/><path d="M2 14h20M7 14v5l5 3 5-3v-5M10 8h4"/>',
 rocketDevelopment:'<path d="m5 17 5-5c0-5 4-9 10-10 0 6-4 10-9 10l-5 5Z"/><circle cx="15" cy="8" r="2"/><path d="M5 12 2 14l1 5 5-2M12 19l-2 3-5-1 2-5M3 22l4-4"/>',
 radar:'<path d="M3 20h18M12 20V9l7-5M12 13l-6-4"/><path d="M13 4a9 9 0 0 1 7 9M16 7a5 5 0 0 1 2 5"/><circle cx="12" cy="12" r="2"/>',
 tankArmor:'<path d="M3 16h18l-2 4H5Z"/><path d="M6 16v-5h12v5M9 11V8h6v3M12 4l-5 2v2M12 4l5 2v2"/><path d="M8 18h8"/>',
 tankMobility:'<path d="M3 14h18l-2 4H5Z"/><path d="M6 14V9h12v5M9 9V6h6v3"/><path d="M3 21h18M17 3h5m-3-2 3 2-3 2"/>'
});
export const researchEffectLabel=Object.freeze({
 armor1:'+10 % Fahrzeug-LP',
 armor2:'Weitere +10 % Fahrzeug-LP',
 precision:'+15 % Waffenschaden',
 engines:'+12 % Fahrzeugtempo',
 infantryTraining:'+15 % Infanterie-LP',
 rocketDevelopment:'+20 % Raketenreichweite',
 radar:'+20 % Sichtweite',
 tankArmor:'+15 % Kampfpanzer-LP',
 tankMobility:'+15 % Kampfpanzertempo'
});
export function researchIconMarkup(kind){
 const paths=researchPaths[kind]??researchPaths.armor1;
 return '<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">'+paths+'</svg>';
}

/** Same physically-lit 3D render pipeline for strategic buildings and
 * research objects, using the actual scene meshes. PNG generation happens
 * once per kind and never on the animation/render loop.
 */
function renderModelPortrait(model,renderer,{width=320,height=220,research=false,infantryCard=false,headquartersCard=false,buildingCard=false}={}){
 // Atlas heavy infantry uses direction index 1: yaw PI/4 with camera (0,8,12).
 // Apply that exact view to the rocket portrait only, never to its game model.
 if(infantryCard)model.rotation.y+=Math.PI/4;
 const scene=new THREE.Scene();
 scene.add(model);
 // Dedicated bright studio for building tiles, not the main game scene.
 const studioBuilding=buildingCard||headquartersCard;
 const hemi=new THREE.HemisphereLight(studioBuilding?'#fffaf2':infantryCard?'#f8fbfd':'#fff3e2',
  infantryCard?'#788b95':'#576e73',
  headquartersCard?3.1:studioBuilding?2.60:infantryCard?2.35:research?2.15:2.0);
 scene.add(hemi);
 const key=new THREE.DirectionalLight(studioBuilding?'#fff9f2':infantryCard?'#f6faff':'#ffedcd',headquartersCard?3.35:studioBuilding?3.05:infantryCard?2.70:research?2.9:2.6);
 key.position.set(210,390,290);scene.add(key);
 const fill=new THREE.DirectionalLight(studioBuilding?'#dce6ea':infantryCard?'#d5e8f4':'#b6dce5',headquartersCard?1.5:studioBuilding?1.45:infantryCard?1.18:.95);
 fill.position.set(-280,170,-170);scene.add(fill);
 // Extra bounce is confined to the isolated HUD scene, never the battlefield.
 if(studioBuilding)scene.add(new THREE.AmbientLight('#fff2dc',headquartersCard?.85:.56));
 const bounds=new THREE.Box3().setFromObject(model);
 const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
 const aspect=width/height;
 const span=Math.max(size.y*(research?1.9:1.8),(size.x+size.z)*(research?1.03:.95),1);
 const camera=new THREE.OrthographicCamera(-span*aspect/2,span*aspect/2,span/2,-span/2,.1,2000);
 camera.position.copy(center).add(infantryCard?
  new THREE.Vector3(0,8,12):new THREE.Vector3(research?115:350,research?115:310,research?170:380));
 camera.lookAt(center);camera.updateMatrixWorld();
 const target=new THREE.WebGLRenderTarget(width,height,{format:THREE.RGBAFormat,depthBuffer:true});
 const oldTarget=renderer.getRenderTarget(),oldColor=renderer.getClearColor(new THREE.Color()).clone();
 const oldAlpha=renderer.getClearAlpha();
 // Portrait-only exposure; always restore after render/readback.
 const oldExposure=renderer.toneMappingExposure;
 const oldViewport=renderer.getViewport(new THREE.Vector4()).clone();
 const oldScissor=renderer.getScissor(new THREE.Vector4()).clone();
 const oldScissorTest=renderer.getScissorTest();
 try{
  if(studioBuilding&&Number.isFinite(oldExposure))
   renderer.toneMappingExposure=Math.max(oldExposure,1.28);
  renderer.setRenderTarget(target);
  renderer.setScissorTest(false);
  renderer.setClearColor('#000000',0);
  renderer.clear(true,true,true);
  renderer.render(scene,camera);
  const pixels=new Uint8Array(width*height*4);
  renderer.readRenderTargetPixels(target,0,0,width,height,pixels);
  const output=document.createElement('canvas');output.width=width;output.height=height;
  const ctx=output.getContext('2d'),rgba=ctx.createImageData(width,height);
  let left=width,top=height,right=-1,bottom=-1;
  for(let y=0;y<height;y++){
   const sourceRow=(height-1-y)*width*4;
   for(let x=0;x<width;x++){
    const i=(y*width+x)*4,j=sourceRow+x*4;
    rgba.data[i]=pixels[j];rgba.data[i+1]=pixels[j+1];
    rgba.data[i+2]=pixels[j+2];rgba.data[i+3]=pixels[j+3];
    if(pixels[j+3]>25){
     left=Math.min(left,x);top=Math.min(top,y);
     right=Math.max(right,x);bottom=Math.max(bottom,y);
    }
   }
  }
  if(right<left)throw new Error('3D portrait is empty: '+model.name);
  const raw=document.createElement('canvas');raw.width=width;raw.height=height;
  raw.getContext('2d').putImageData(rgba,0,0);
  const w=right-left+1,h=bottom-top+1;
  // Same pixel bounds and bottom alignment as rasterizeUnitIcon('heavy').
  // This prevents the shoulder launcher from altering the soldier's apparent size.
  // Scale infantry by body height, NOT by the shoulder launcher's width.
  // Otherwise the longer weapon makes the entire rocket soldier appear tiny.
  const scale=infantryCard?105/h:
   Math.min(width*(research?.89:.93)/w,height*(research?.89:.92)/h);
  const dw=w*scale,dh=h*scale;
  let drawX=(width-dw)/2;
  if(infantryCard){
   // Frame on the armored torso, not on the launcher protruding to one side.
   // Heavy infantry's atlas similarly centers the soldier rather than the gun.
   const torso=model.getObjectByName('Atlas_Breastplate');
   if(torso){
    const projected=torso.getWorldPosition(new THREE.Vector3()).project(camera);
    const pixelX=(projected.x*.5+.5)*width;
    drawX=width*.5-(pixelX-left)*scale;
   }
  }
  ctx.clearRect(0,0,width,height);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(raw,left,top,w,h,drawX,infantryCard?119-dh:(height-dh)/2,dw,dh);
  return output.toDataURL('image/png');
 }finally{
  renderer.toneMappingExposure=oldExposure;
  renderer.setRenderTarget(oldTarget);
  renderer.setViewport(oldViewport);
  renderer.setScissor(oldScissor);
  renderer.setScissorTest(oldScissorTest);
  renderer.setClearColor(oldColor,oldAlpha);
  target.dispose();
  const geometries=new Set(),materials=new Set();
  model.traverse(node=>{
   if(!node.isMesh)return;
   if(node.geometry)geometries.add(node.geometry);
   for(const m of (Array.isArray(node.material)?node.material:[node.material]))if(m)materials.add(m);
  });
  for(const geometry of geometries)geometry.dispose();
  for(const material of materials)material.dispose();
 }
}
function renderStrategicPortrait(kind,renderer){
 const model=createStrategicBuilding(kind,0);
 if(!model)return strategicBuildingIcon(kind);
 // The live 125-unit missile extends far below the launch deck. Three.js
 // includes those vertices (and hidden shaft floors) when framing a portrait,
 // producing a tiny, misleading silo image. Portraits must show the ACTUAL
 // top-side silhouette, not the underground construction mesh.
 if(kind==='silo'&&!prepareSiloForPortrait(model))
  throw new Error('Silo HUD portrait could not trim buried missile geometry');
 tintFactionMaterials(model,0,kind,'building');
 return renderModelPortrait(model,renderer,{buildingCard:true});
}
const researchArtworkCache=new Map();
export function researchArtwork(kind,renderer){
 if(!RESEARCH_ARTWORK_KINDS.includes(kind))return Promise.reject(new Error('Unknown research artwork '+kind));
 if(!researchArtworkCache.has(kind))
  researchArtworkCache.set(kind,new Promise((resolve,reject)=>{
   // Render each card after the current UI frame; avoids blocking the first
   // battlefield paint and keeps the same synchronous WebGL context.
   requestAnimationFrame(()=>{
    try{
     const model=createResearchArtwork(kind);
     if(!model||!renderer)throw new Error('Research renderer unavailable');
     resolve(renderModelPortrait(model,renderer,{width:256,height:256,research:true}));
    }catch(error){reject(error);}
   });
  }).catch(error=>{researchArtworkCache.delete(kind);throw error;}));
 return researchArtworkCache.get(kind);
}
/** Large authored miniature on the left; the original vector is always a
 * readable fallback if WebGL or canvas readback is unavailable.
 */
export function hydrateResearchArtworks(root,renderer){
 for(const img of root.querySelectorAll('img[data-sf-research-artwork]')){
  const kind=img.dataset.sfResearchArtwork;
  if(!kind||img.dataset.sfArtStatus)return;
  img.dataset.sfArtStatus='loading';
  researchArtwork(kind,renderer).then(url=>{
   if(img.isConnected&&img.dataset.sfResearchArtwork===kind){
    img.src=url;
    img.dataset.sfArtStatus='ready';
   }
  }).catch(error=>{
   if(img.isConnected)img.dataset.sfArtStatus='error';
   console.warn('Research 3D icon fallback:',kind,error);
  });
 }
}

function loadImage(src){
 return new Promise((resolve,reject)=>{
  const img=new Image();
  img.onload=()=>resolve(img);
  img.onerror=()=>reject(new Error('Portrait sprite missing: '+src));
  img.src=src;
 });
}
async function rasterizeUnitIcon(kind){
 const source=unitAtlasUrl(kind);
 const response=await fetch(source+'.json');
 if(!response.ok)throw new Error('Portrait metadata missing '+source+' ('+response.status+')');
 const atlas=await response.json();
 const image=await loadImage(source+'.png');
 const directions=atlas.clips?.idle?.frames;
 if(!Array.isArray(directions)||!directions.length||!Array.isArray(atlas.frames))
  throw new Error('Invalid idle frames for '+kind);
 const frameIndex=directions[Math.min(1,directions.length-1)]?.[0];
 const frame=atlas.frames[frameIndex];
 if(!frame)throw new Error('Missing idle sprite frame '+frameIndex+' for '+kind);
 const tile=document.createElement('canvas');
 tile.width=frame.w;tile.height=frame.h;
 const tc=tile.getContext('2d',{willReadFrequently:true});
 tc.drawImage(image,frame.x,frame.y,frame.w,frame.h,0,0,frame.w,frame.h);
 // Multi-layered vehicle turrets are stored as independent frames.
 for(const part of ['turret','barrel']){
  const layerIndex=atlas.clips?.[part]?.frames?.[Math.min(1,directions.length-1)]?.[0];
  const layer=atlas.frames[layerIndex];
  if(!layer)continue;
  tc.drawImage(image,layer.x,layer.y,layer.w,layer.h,
   (frame.pivot?.[0]??frame.w/2)-(layer.pivot?.[0]??layer.w/2),
   (frame.pivot?.[1]??frame.h*.8)-(layer.pivot?.[1]??layer.h*.8),
   layer.w,layer.h);
 }
 const rgba=tc.getImageData(0,0,tile.width,tile.height).data;
 let left=tile.width,top=tile.height,right=-1,bottom=-1;
 for(let y=0;y<tile.height;y++)for(let x=0;x<tile.width;x++){
  if(rgba[(y*tile.width+x)*4+3]<90)continue;
  left=Math.min(left,x);right=Math.max(right,x);
  top=Math.min(top,y);bottom=Math.max(bottom,y);
 }
 if(right<left)throw new Error('Empty alpha frame for '+kind);
 const target=document.createElement('canvas');target.width=192;target.height=132;
 const ctx=target.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 const w=right-left+1,h=bottom-top+1;
 // Keep all four ground soldiers at the same apparent standing height,
 // matching the original role illustrations regardless of atlas whitespace.
 const infantry=['infantry','medic','engineer','heavy'].includes(kind);
 const scale=Math.min((infantry?144:164)/w,(infantry?105:112)/h);
 const dw=w*scale,dh=h*scale;
 ctx.drawImage(tile,left,top,w,h,(192-dw)/2,infantry?119-dh:(132-dh)/2,dw,dh);
 return target.toDataURL('image/png');
}
/** Offline vector backup for the original 3D portrait (no asset fetch). */
function rocketUnitIconFallback(){
 const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 132"><rect width="192" height="132" fill="#28322d"/><g transform="translate(30 0) scale(.69)">'+
 '<path fill="#8d987c" d="M62 68h67v75H62z"/>'+
 '<path fill="#baa882" d="M60 145h28v32H60zm49 0h28v32h-28z"/>'+
 '<circle cx="96" cy="51" r="25" fill="#aca787"/>'+
 '<rect x="69" y="27" width="64" height="10" fill="#516757"/>'+
 '<rect x="102" y="60" width="17" height="81" rx="6" transform="rotate(-75 110 105)" fill="#39453f"/>'+
 '<path stroke="#dcbe83" stroke-width="5" d="m147 57 23 17-25 11"/>'+
 '</g></svg>';
 return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg);
}
export function unitIcon(kind,renderer){
 if(kind==='supply'){
  // Use the same user-provided 6×6 GLB in the catalogue, production row
  // and selected-unit HUD. Render once and cache the pixels; no SVG toy truck.
  const fallback=()=>{
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 132">'+
   '<rect width="192" height="132" fill="#1d2828"/>'+
   '<rect x="16" y="61" width="108" height="45" rx="7" fill="#aba080"/>'+
   '<rect x="112" y="71" width="52" height="35" rx="4" fill="#b7a789"/>'+
   '<rect x="119" y="75" width="27" height="16" fill="#354849"/>'+
   '<rect x="26" y="47" width="85" height="20" rx="5" fill="#89876b"/>'+
   '<rect x="26" y="94" width="136" height="9" fill="#425451"/>'+
   '<circle cx="45" cy="108" r="13" fill="#343c3a"/>'+
   '<circle cx="104" cy="108" r="13" fill="#343c3a"/>'+
   '<circle cx="147" cy="108" r="13" fill="#343c3a"/>'+
   '<path d="M36 80h56" stroke="#4c909d" stroke-width="8"/>'+
   '<path d="M38 55h58" stroke="#dbd0a5" stroke-width="4"/>'+
   '</svg>';
  return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg);
  };
  if(!renderer)return Promise.resolve(fallback());
  if(!iconCache.has(kind))iconCache.set(kind,(async()=>{
   const loader=new GLTFLoader();
   let data;
   try{data=await loader.loadAsync(customSupplyTruckUrl(0));}
   catch{data=await loader.loadAsync('/src/assets/reborn/supply-pbr/supply-0.glb');}
   const model=cloneSkeleton(data.scene);
   prepareCustomSupplyTruck(model,0);
   // Portrait render disposes its temporary meshes, so never share their
   // geometry or material objects with an in-game GLB instance.
   model.traverse(node=>{
    if(!node.isMesh)return;
    node.geometry=node.geometry.clone();
    node.material=Array.isArray(node.material)
     ?node.material.map(material=>material.clone()):node.material.clone();
   });
   return renderModelPortrait(model,renderer,{width:192,height:132});
  })().catch(error=>{
   iconCache.delete(kind);
   console.warn('Supply truck GLB portrait fallback:',error);
   return fallback();
  }));
  return iconCache.get(kind);
 }
 if(kind==='rocket'&&!renderer)return Promise.resolve(rocketUnitIconFallback());
 if(kind==='rocket'&&!iconCache.has(kind)){
  iconCache.set(kind,new Promise((resolve,reject)=>{
   requestAnimationFrame(async()=>{
    try{
     // The catalog uses the SAME animated Atlas body and physical launcher
     // as the battle. Do not crop a static, unrelated toy-like placeholder.
     const data=await new GLTFLoader().loadAsync('/src/assets/reborn/prototype/infantry-0.glb');
     const model=cloneSkeleton(data.scene);
     // renderModelPortrait disposes temporary geometry/materials: clone them
     // so the loader's cached GLB assets never become unusable in gameplay.
     model.traverse(node=>{
      if(!node.isMesh)return;
      node.geometry=node.geometry.clone();
      node.material=Array.isArray(node.material)?
       node.material.map(m=>m.clone()):node.material.clone();
     });
     attachRocketLauncherToInfantry(model,0);
     resolve(renderModelPortrait(model,renderer,{width:192,height:132,infantryCard:true}));
    }catch(error){reject(error);}
   });
  }).catch(error=>{
   iconCache.delete(kind);
   console.warn('Animated rocket 3D portrait fallback:',error);
   try{return renderModelPortrait(createRocketInfantry(0),renderer,{width:192,height:132,infantryCard:true});}
   catch{return rocketUnitIconFallback();}
  }));
 }
 if(!iconCache.has(kind))iconCache.set(kind,rasterizeUnitIcon(kind).catch(error=>{
  iconCache.delete(kind);throw error;
 }));
 return iconCache.get(kind);
}
// Transparent padding in original building PNGs makes their thumbnails
// look tiny. Trim alpha bounds at low resolution and draw the whole building
// into a consistent wide tile without clipping its silhouette.
const buildingIconCache=new Map();
async function rasterizeBuildingIcon(kind,renderer){
 if(isStrategicBuilding(kind)){
  if(!renderer)return buildingIconUrl(kind);
  try{return renderStrategicPortrait(kind,renderer);}
  catch(error){console.warn('Strategic portrait fallback:',kind,error);return buildingIconUrl(kind);}
 }
 // Airfield uses a dedicated PBR hangar GLB; it is not part of the older
 // generic building shader allowlist, but must still render in the HUD.
 if((DESERT_BUILDING_KINDS.includes(kind)||kind==='airfield'||kind==='generator')&&renderer){
  try{
   // The image tiles in the HUD must match the *real* 3D materials exactly.
   // Preview assets get their own buffers; renderModelPortrait frees them.
   const [data]=await Promise.all([
    new GLTFLoader().loadAsync('/src/assets/reborn/buildings-3d/'+kind+'-0.glb'),
    waitForDesertBuildingTextures()
   ]);
   const model=data.scene.clone(true);
   model.traverse(node=>{
    if(!node.isMesh)return;
    node.geometry=node.geometry.clone();
    node.material=Array.isArray(node.material)?
     node.material.map(m=>m.clone()):node.material.clone();
   });
   const authoredHQ=kind==='headquarters'&&hasAuthoredHeadquartersPBR(model);
   const authoredBarracks=kind==='barracks'&&hasFinalBarracksPBR(model);
   const authoredFactory=kind==='factory'&&Boolean(model.getObjectByName('SF_Factory_PBR_roof')&&model.getObjectByName('FactoryRollupDoor'));
   const authoredAirfield=kind==='airfield'&&Boolean(model.getObjectByName('SF_Airfield_PBR_Root')&&model.getObjectByName('HangarDoorLeft_0')&&model.getObjectByName('HangarDoorRight_0'));
   const authoredGenerator=kind==='generator'&&Boolean(model.getObjectByName('SF_EnergyCore_PBR_Housing'));
   if(authoredHQ){
    // Same original PBR textures as the real domed command centre.
    prepareAuthoredHeadquartersPortrait(model);
   }else if(authoredBarracks){
    // Keep the hand-authored desert camouflage, not the legacy orange
    // recolor applied to old procedural barracks.
    if(polishBarracksProps(model))model.traverse(node=>{
     if(!node.isMesh||!node.userData.sandforgeBarracksPropPolish)return;
     // Generated prop resources are shared with the main world. Isolate
     // them before the temporary HUD renderer disposes its scene.
     node.geometry=node.geometry.clone();
     node.material=Array.isArray(node.material)?
      node.material.map(m=>m.clone()):node.material.clone();
    });
    prepareFinalBarracksPortrait(model);
   }else if(authoredFactory||authoredAirfield||authoredGenerator){
    // Keep HUD and gameplay in sync: only the external factory/hangar wall
    // gets the barracks palette, with the original roof and gate preserved.
    if(authoredFactory||authoredAirfield)finishDesertBuildingMaterials(model,kind);
   }else{
    if(kind==='barracks')finishBarracksSides(model);
    tintFactionMaterials(model,0,kind,'building');
    if(kind==='barracks')finishBarracksDesertPalette(model);
    finishDesertBuildingMaterials(model,kind);
    finishBuildingFacadeShading(model);
   }
   // Same flush roof insignia in the actual battle, placement ghost and HUD.
   if(authoredHQ||authoredBarracks){
    paintFactionRoofStripes(model,kind,0);
    paintFactionEntranceBanners(model,kind,0);
   }
   return renderModelPortrait(model,renderer,{buildingCard:true,headquartersCard:authoredHQ});
  }catch(error){
   console.warn('Desert building PBR portrait fallback:',kind,error);
  }
 }
 const image=await loadImage(buildingIconUrl(kind));
 let source=image;
 if(kind==='turret'){
  // The authored turret body PNG deliberately EXCLUDES its moving weapon
  // head. The classic 2D renderer draws that from a separate direction
  // atlas; compose the same two layers for the static WebGL build card.
  const response=await fetch('/src/assets/reborn/buildings-3d/turret-0.json');
  if(!response.ok)throw new Error('Turret weapon metadata missing');
  const data=await response.json();
  const layer=data.turret,body=data.body;
  const frame=layer?.frames?.[0];
  if(!frame||!layer?.pivot||!body?.pivot||!layer.image)
   throw new Error('Turret weapon layer missing');
  const turret=await loadImage('/src/assets/reborn/buildings-3d/'+layer.image);
  const composed=document.createElement('canvas');
  composed.width=image.naturalWidth;composed.height=image.naturalHeight;
  const cc=composed.getContext('2d');
  cc.drawImage(image,0,0);
  cc.drawImage(turret,frame.x,frame.y,frame.w,frame.h,
   body.pivot[0]-layer.pivot[0],body.pivot[1]-layer.pivot[1],
   frame.w,frame.h);
  source=composed;
 }
 const width=source.naturalWidth??source.width;
 const height=source.naturalHeight??source.height;
 const ratio=Math.min(1,384/Math.max(width,height));
 const probe=document.createElement('canvas');
 probe.width=Math.max(1,Math.round(width*ratio));
 probe.height=Math.max(1,Math.round(height*ratio));
 const pc=probe.getContext('2d',{willReadFrequently:true});
 pc.drawImage(source,0,0,probe.width,probe.height);
 const pixels=pc.getImageData(0,0,probe.width,probe.height).data;
 let left=probe.width,top=probe.height,right=-1,bottom=-1;
 for(let y=0;y<probe.height;y++)for(let x=0;x<probe.width;x++){
  if(pixels[(y*probe.width+x)*4+3]<36)continue;
  left=Math.min(left,x);top=Math.min(top,y);
  right=Math.max(right,x);bottom=Math.max(bottom,y);
 }
 if(right<left)throw new Error('Empty building portrait: '+kind);
 const sx=left/ratio,sy=top/ratio;
 const w=(right-left+1)/ratio,h=(bottom-top+1)/ratio;
 const target=document.createElement('canvas');
 target.width=320;target.height=220;
 const ctx=target.getContext('2d');
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 const scale=Math.min(306/w,208/h);
 const dw=w*scale,dh=h*scale;
 ctx.drawImage(source,sx,sy,w,h,(320-dw)/2,(220-dh)/2,dw,dh);
 return target.toDataURL('image/png');
}
export function buildingIcon(kind,renderer){
 if(!buildingIconCache.has(kind))
  buildingIconCache.set(kind,rasterizeBuildingIcon(kind,renderer).catch(error=>{
   buildingIconCache.delete(kind);throw error;
  }));
 return buildingIconCache.get(kind);
}
export function hydrateBuildingIcons(root,renderer){
 for(const img of root.querySelectorAll('img[data-sf-building-icon]')){
  const kind=img.dataset.sfBuildingIcon;
  if(!kind||img.dataset.sfIconStatus)return;
  img.dataset.sfIconStatus='loading';
  buildingIcon(kind,renderer).then(url=>{
   if(img.isConnected&&img.dataset.sfBuildingIcon===kind){
    img.src=url;img.dataset.sfIconStatus='ready';
   }
  }).catch(error=>{
   if(img.isConnected)img.dataset.sfIconStatus='error';
   console.warn('Building portrait fallback:',kind,error);
  });
 }
}

export function hydrateUnitIcons(root,renderer){
 for(const img of root.querySelectorAll('img[data-sf-unit-icon]')){
  const kind=img.dataset.sfUnitIcon;
  if(!kind||img.dataset.sfIconStatus)return;
  img.dataset.sfIconStatus='loading';
  unitIcon(kind,renderer).then(url=>{
   if(img.isConnected&&img.dataset.sfUnitIcon===kind){img.src=url;img.dataset.sfIconStatus='ready';}
  }).catch(error=>{
   if(img.isConnected){img.dataset.sfIconStatus='error';img.alt=kind;}
   console.warn('Unit portrait fallback:',kind,error);
  });
 }
}
