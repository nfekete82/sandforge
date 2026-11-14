import * as THREE from 'three';
import {addFinalHeadquartersRoofDetails} from './webgl-final-hq-roof.js';

/** User-supplied 2026-11-14 desert camouflage, palette-quantized 48x34.
 * Retain original UV-albedo as detail: repaint with a triplanar overlay.
 * Only the final Feldkommando uses this texture; the barracks is untouched.
 */
export const FINAL_HQ_FINISH='final-feldkommando-user-camo-v3';
export const FINAL_HQ_CAMO_COLORS=Object.freeze([
 0xece1cf,0xddceb7,0xd4c1a5,0xcab89f,
 0xc3ad93,0xb99f83,0xa78160,0x7d5c40
]);
const PIXELS='BgBg/3/bbaskAdh2SbQgqV3/DwBA/v//drslY9u2bLUg83//NwAAs+3/f0lKLNm27bQgav3//gUA0KTeLseR2pSNnRQgydTf7AsAyKaoLEdyIwNAUwAAEbe+AgAASKKN7TbaNoPQnpREJLWRBQAASJJt2zb2t6Da3spkG+22HsABQBKN27bNv+36b1utHW3btm0HAJJM27aN9v//ts3arm3btm07AJIEIbdttW37tl3atm3bmm27kaYEIcmRbEn7tm3brk2SEm/bEzlkJMma3DTbtm2XtSdJyv7b7saNJMnaLjUpst2AbTJNiP7/tzuSJEnatoMAiAIgGjJJSPr/v02SJEnSthmRAQYAADItQBL//12S2ySytt3W5R8kAKItAID9/99MkqTZttu2/gskSSYJAQD+RQJIkkTbtrS2bTsmkiQpCgD8AYCwtm3btrRtbdtOkiRJUoIkiILYpW3btrRtLCdJkiRN27Yt2RYA0F3bbraVUwJokqRt27htUrQgSGXbzUq2HQBAkpJtG8uRJJUgAUJRYdu2pZAAibZtbdu2bQMgCoAkIsuWLakACZCNZNu2bAAkrcS2krRSLCsAQAKxSdgyAKQkY1v/i6RJbDsAQKt0pNQO6qQkEPvfLSVJElsm2dqWLWvb9pQkGev/vyVJEtu2vc2S/2/b9iQlJMf6riRJI0m2/+/1/23b7SQhJCnZkSSJJEmS/v//v7VtkwAgmgJEkiSJJLmN/v//vzWSAgAAQBJkkiZJI7f+/////01IAAAASNshCbRN2lj/vu3/yf8CAABEa9sGABBt29r+tsX/';
let texture;
export function finalHqCamouflageTexture(){
 if(texture)return texture;
 const bytes=Uint8Array.from(atob(PIXELS),c=>c.charCodeAt(0));
 const data=new Uint8Array(48*34*4);
 for(let i=0;i<48*34;i++){
  const bit=i*3,offset=bit&7;
  let index=bytes[bit>>3]>>offset;
  if(offset>5)index|=bytes[(bit>>3)+1]<<(8-offset);
  const c=FINAL_HQ_CAMO_COLORS[index&7],p=i*4;
  data[p]=(c>>16)&255;data[p+1]=(c>>8)&255;
  data[p+2]=c&255;data[p+3]=255;
 }
 texture=new THREE.DataTexture(data,48,34,THREE.RGBAFormat);
 texture.name='User_Supplied_Desert_Camouflage_Feldkommando';
 texture.wrapS=texture.wrapT=THREE.MirroredRepeatWrapping;
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.magFilter=THREE.LinearFilter;
 texture.minFilter=THREE.LinearMipmapLinearFilter;
 texture.generateMipmaps=true;
 texture.anisotropy=8;
 texture.needsUpdate=true;
 return texture;
}
function addDishDetails(root){
 const pivot=root.getObjectByName('Radar_Dish_Pivot');
 if(!pivot||pivot.getObjectByName('SF_Final_Dish_Feed_Assembly'))return false;
 // The original bowl is kept. Complete only its missing focal struts/feed.
 const assembly=new THREE.Group();assembly.name='SF_Final_Dish_Feed_Assembly';
 const metal=new THREE.MeshStandardMaterial({name:'SF_Dish_Feed_Sandsteel',
  color:'#9f927b',roughness:.72,metalness:.26});
 const capMat=new THREE.MeshStandardMaterial({name:'SF_Dish_Feed_Horn',
  color:'#665b4d',roughness:.62,metalness:.38});
 const point=new THREE.Vector3(0,.064,.080);
 for(const x of [-.038,0,.038]){
  const start=new THREE.Vector3(x,.028,.023);
  const vector=point.clone().sub(start);
  const rod=new THREE.Mesh(new THREE.CylinderGeometry(.0018,.0023,vector.length(),8),metal);
  rod.name='SF_Final_Dish_Feed_Arm';
  rod.position.copy(start).addScaledVector(vector,.5);
  rod.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),vector.normalize());
  rod.castShadow=true;assembly.add(rod);
 }
 const horn=new THREE.Mesh(new THREE.CylinderGeometry(.007,.004,.012,12),capMat);
 horn.name='SF_Final_Dish_Feedhorn';
 horn.position.copy(point);
 horn.rotation.x=Math.PI/2;
 horn.castShadow=true;assembly.add(horn);
 const receiver=new THREE.Mesh(new THREE.BoxGeometry(.015,.010,.020),capMat);
 receiver.name='SF_Final_Dish_Receiver';
 receiver.position.set(point.x,point.y-.008,point.z-.009);
 receiver.castShadow=true;assembly.add(receiver);
 pivot.add(assembly);
 return true;
}
export function polishFinalFeldkommando(root){
 if(!root?.getObjectByName?.('SF_Feldkommando_Final'))return false;
 if(root.userData?.sandforgeFinalHqFinish===FINAL_HQ_FINISH)return false;
 const sourceMap=new Map();
 root.traverse(mesh=>{
  if(!mesh.isMesh||mesh.parent?.name==='SF_Final_Dish_Feed_Assembly')return;
  // Preserve the mechanically split sliding doors and authentic radar coating.
  if(/^(Radar_Dish_Pivot|Door_(Left|Right)_Pivot|SF_Final_DarkEntrance)$/.test(mesh.name))return;
  const make=source=>{
   if(!source?.isMeshStandardMaterial||!source.map)return source;
   if(sourceMap.has(source))return sourceMap.get(source);
   const material=source.clone();
   material.name='SF_Final_Desert_Camo';
   material.roughness=Math.max(.87,material.roughness);
   material.metalness=Math.min(.13,material.metalness);
   const prior=material.onBeforeCompile;
   material.onBeforeCompile=function(shader,renderer){
    prior?.call(this,shader,renderer);
    shader.uniforms.sfFinalCamoTex={value:finalHqCamouflageTexture()};
    shader.vertexShader=shader.vertexShader.replace('#include <common>',
     '#include <common>\nvarying vec3 sfFinalWorld; varying vec3 sfFinalNormal; varying vec3 sfFinalLocal;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
     '#include <begin_vertex>\nsfFinalWorld=(modelMatrix*vec4(transformed,1.0)).xyz;sfFinalNormal=normalize(mat3(modelMatrix)*normal);sfFinalLocal=transformed;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
     '#include <common>\nvarying vec3 sfFinalWorld; varying vec3 sfFinalNormal; varying vec3 sfFinalLocal; uniform sampler2D sfFinalCamoTex;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',[
    '#include <color_fragment>',
    'vec3 sfAxis=pow(abs(normalize(sfFinalNormal)),vec3(4.0));',
    'sfAxis/=max(dot(sfAxis,vec3(1.0)),.001);',
    // The screenshot's cream walls were excluded by the previous narrow
    // chroma cutoff. This preserves fine baked dirt/grille UV detail while
    // making the supplied beige/tan/brown camouflage obvious at RTS zoom.
    'vec3 sfPaint=texture2D(sfFinalCamoTex,sfFinalWorld.zy*.014).rgb*sfAxis.x',
    '+texture2D(sfFinalCamoTex,sfFinalWorld.xy*.014).rgb*sfAxis.z',
    '+texture2D(sfFinalCamoTex,sfFinalWorld.xz*.014).rgb*sfAxis.y;',
    'vec3 sfOrig=diffuseColor.rgb;',
    'float sfMax=max(max(sfOrig.r,sfOrig.g),sfOrig.b);',
    'float sfMin=min(min(sfOrig.r,sfOrig.g),sfOrig.b);',
    'float sfChroma=sfMax-sfMin;',
    'float sfLuma=dot(sfOrig,vec3(.2126,.7152,.0722));',
    'float sfWhiteStar=smoothstep(.78,.90,sfLuma)*(1.0-smoothstep(.030,.070,sfChroma));',
    'float sfBlue=smoothstep(.07,.19,sfOrig.b-max(sfOrig.r,sfOrig.g))',
    '*smoothstep(.14,.30,sfOrig.b);',
    'float sfMask=(1.0-smoothstep(.34,.50,sfChroma))',
    '*smoothstep(.08,.21,sfLuma)*(1.0-sfWhiteStar)*(1.0-sfBlue);',
    'float sfRelief=clamp(.73+.43*sfLuma,.77,1.10);',
    // Darker matte sand on upward roof faces, protected black ventilators.
    'float sfRoof=smoothstep(.59,.87,abs(sfFinalNormal.y))',
    '*smoothstep(-.19,-.049,sfFinalLocal.y);',
    'sfPaint*=mix(vec3(1.0),vec3(.73,.72,.69),sfRoof*.46);',
    'vec3 sfSurface=mix(sfOrig,sfPaint*sfRelief,.97*sfMask);',
    // Preserve command-tower and central-front blue team banners; replace
    // oversize faceless blue cladding with dusty steel/sand instead.
    'float sfTowerFlag=smoothstep(.085,.135,sfFinalLocal.y);',
    'float sfFrontFlag=smoothstep(.19,.265,sfFinalLocal.z)',
    '*smoothstep(.045,.14,sfFinalLocal.x)*(1.0-smoothstep(.26,.33,sfFinalLocal.x));',
    'float sfKeepBlue=clamp(sfTowerFlag+sfFrontFlag,0.0,1.0);',
    'vec3 sfDustySteel=mix(sfPaint*sfRelief,vec3(.20,.26,.28),.23);',
    'sfSurface=mix(sfSurface,sfDustySteel,sfBlue*.88*(1.0-sfKeepBlue));',
    'diffuseColor.rgb=clamp(sfSurface,0.0,1.0);'
   ].join('\n'));
   };
   material.customProgramCacheKey=()=>FINAL_HQ_FINISH;
   material.userData={...material.userData,sandforgeFinalCamo:true,
    sandforgePreserveHQDesertTextures:true};
   material.needsUpdate=true;
   sourceMap.set(source,material);
   return material;
  };
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(make):make(mesh.material);
 });
 addDishDetails(root);
 addFinalHeadquartersRoofDetails(root);
 root.userData.sandforgeFinalHqFinish=FINAL_HQ_FINISH;
 return true;
}
