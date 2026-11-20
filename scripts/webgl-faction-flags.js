import * as THREE from 'three';
import {FACTION_BLUE,FACTION_RED,FACTION_PAINT} from './sandforge-faction-palette.js';

/** One source of truth for every Sandforge cloth faction flag.
 * Blue = player / white FIVE-point star; red = opponent / same white star.
 * Material and UV design are independent of the lighting, unit camouflage,
 * HUD colours and capture-bar semantics.
 */
export const FACTION_FLAG_REVISION='sandforge-identical-five-point-white-star-v1';
export const FACTION_FLAG_WHITE='#ffffff';
export const FACTION_FLAG_COLORS=Object.freeze({0:FACTION_BLUE,1:FACTION_RED});
const textures=new Map();
const WIDTH=256,HEIGHT=128;
function starPolygon(){
 const cx=.53,cy=.5,outer=.285,inner=.118;
 const result=[];
 for(let i=0;i<10;i++){
  const theta=-Math.PI/2+i*Math.PI/5,r=i%2===0?outer:inner;
  result.push({x:cx+Math.cos(theta)*r*.50,y:cy+Math.sin(theta)*r});
 }
 return result;
}
const STAR=starPolygon();
function insideStar(u,v){
 let inside=false;
 for(let i=0,j=STAR.length-1;i<STAR.length;j=i++){
  const a=STAR[i],b=STAR[j];
  if((a.y>v)!==(b.y>v)&&
   u<(b.x-a.x)*(v-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }
 return inside;
}
export function factionFlagTexture(owner=0){
 const team=owner===1?1:0;
 if(textures.has(team))return textures.get(team);
 const hex=FACTION_FLAG_COLORS[team];
 const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
 const data=new Uint8Array(WIDTH*HEIGHT*4);
 for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
  // Four coverage samples keep the white star recognizable at RTS zoom.
  let coverage=0;
  for(const ox of [.25,.75])for(const oy of [.25,.75]){
   if(insideStar((x+ox)/WIDTH,(y+oy)/HEIGHT))coverage+=.25;
  }
  const i=(y*WIDTH+x)*4;
  const thread=Math.sin(x*.24+y*.035)*.015+
   Math.sin(x*.46-y*.10)*.008;
  const edge=(x<3||x>=WIDTH-3||y<3||y>=HEIGHT-3)?.83:1;
  for(let c=0;c<3;c++){
   const cloth=rgb[c]*edge*(1+thread);
   data[i+c]=Math.round(Math.max(0,Math.min(255,
    cloth*(1-coverage)+255*coverage)));
  }
  data[i+3]=255;
 }
 const texture=new THREE.DataTexture(data,WIDTH,HEIGHT,THREE.RGBAFormat);
 texture.name='Sandforge '+(team===0?'Blue':'Red')+' flag with pure white five-point star';
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;
 texture.magFilter=THREE.LinearFilter;
 texture.minFilter=THREE.LinearMipmapLinearFilter;
 texture.generateMipmaps=true;texture.anisotropy=4;texture.needsUpdate=true;
 texture.userData={revision:FACTION_FLAG_REVISION,owner:team,emblem:'white-star'};
 textures.set(team,texture);return texture;
}
export function factionFlagMaterial(owner=0,{windSafe=true}={}){
 const material=new THREE.MeshStandardMaterial({
  name:'Sandforge '+(owner===1?'Red':'Blue')+' WhiteStar Cloth',
  color:'#ffffff',map:factionFlagTexture(owner),roughness:.96,
  metalness:0,side:THREE.DoubleSide
 });
 material.userData={sandforgeTeamFlag:true,owner:owner===1?1:0,
  authoredFlagTexture:true,sandforgeOwnedFlagCloth:true,
  revision:FACTION_FLAG_REVISION,windSafe};
 return material;
}

/** Replace the colors on an AUTHORED UV-mapped fabric mesh only;
 * never override original building concrete, radar, windows or flags on
 * equipment. The original glTF model source is not modified.
 */
export function unifyModelFactionFlags(model,owner){
 if(!model||(owner!==0&&owner!==1))return 0;
 let count=0;
 model.traverse(mesh=>{
  if(!mesh.isMesh)return;
  // HQ and barracks have their own real wall-mounted star plaques. Their
  // colored rectangles and 3D white star must NOT be converted into a cloth
  // texture with another star drawn on top.
  for(let parent=mesh;parent;parent=parent.parent)
   if(parent.name==='SF_FactionEntranceBanners')return;
  if(mesh.userData?.sandforgeTeamFlag){
   if(mesh.userData.flagOwner!==owner){
    const old=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    mesh.material=factionFlagMaterial(owner);
    for(const m of new Set(old))if(m?.userData?.sandforgeOwnedFlagCloth)m.dispose();
    mesh.userData.flagOwner=owner;count++;
   }
   return;
  }
  if(!/(flag|banner|pennant|fabric)/i.test(mesh.name))return;
  // Do not recolour name-only parent components, solid supports or poles.
  if(/mast|pole|rod|frame|anchor|bracket|mount|support|stem|clamp|rail/i.test(mesh.name))return;
  if(!mesh.geometry?.attributes?.uv)return;
  const source=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
  if(!source?.isMeshStandardMaterial||source.transparent&&source.opacity<.6)return;
  const cloth=factionFlagMaterial(owner);
  if(Array.isArray(mesh.material))mesh.material=mesh.material.map(()=>cloth);
  else mesh.material=cloth;
  mesh.userData={...mesh.userData,sandforgeTeamFlag:true,flagOwner:owner};
  count++;
 });
 return count;
}
