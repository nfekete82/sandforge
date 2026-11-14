import * as THREE from 'three';

/** User-supplied 2026-11-14 desert camouflage, palette-quantized 48x34.
 * Retain original UV-albedo as detail: repaint with a triplanar overlay.
 * Only the final Feldkommando uses this texture; the barracks is untouched.
 */
export const FINAL_HQ_FINISH='final-feldkommando-user-camo-v2';
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
 const point=new THREE.Vector3(0,.054,.084);
 for(const x of [-.034,.034]){
  const start=new THREE.Vector3(x,.032,.024);
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
 pivot.add(assembly);
 return true;
}
export function polishFinalFeldkommando(root){
 if(!root?.getObjectByName?.('SF_Feldkommando_Final'))return false;
 if(root.userData?.sandforgeFinalHqFinish===FINAL_HQ_FINISH)return false;
 const sourceMap=new Map();
 root.traverse(mesh=>{
  if(!mesh.isMesh||mesh.parent?.name==='SF_Final_Dish_Feed_Assembly')return;
  const make=source=>{
   if(!source?.isMeshStandardMaterial||!source.map)return source;
   if(sourceMap.has(source))return sourceMap.get(source);
   const material=source.clone();
   material.name='SF_Final_Desert_Camo';
   const prior=material.onBeforeCompile;
   material.onBeforeCompile=function(shader,renderer){
    prior?.call(this,shader,renderer);
    shader.uniforms.sfFinalCamoTex={value:finalHqCamouflageTexture()};
    shader.vertexShader=shader.vertexShader.replace('#include <common>',
     '#include <common>\nvarying vec3 sfFinalWorld; varying vec3 sfFinalNormal;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
     '#include <begin_vertex>\nsfFinalWorld=(modelMatrix*vec4(transformed,1.0)).xyz;sfFinalNormal=normalize(mat3(modelMatrix)*normal);');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
     '#include <common>\nvarying vec3 sfFinalWorld; varying vec3 sfFinalNormal; uniform sampler2D sfFinalCamoTex;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',[
     '#include <color_fragment>',
     'vec3 sfAxis=pow(abs(normalize(sfFinalNormal)),vec3(4.0));',
     'sfAxis/=max(dot(sfAxis,vec3(1.0)),.001);',
     'vec3 sfPaint=texture2D(sfFinalCamoTex,sfFinalWorld.zy*.0074).rgb*sfAxis.x',
     '+texture2D(sfFinalCamoTex,sfFinalWorld.xy*.0074).rgb*sfAxis.z',
     '+texture2D(sfFinalCamoTex,sfFinalWorld.xz*.0074).rgb*sfAxis.y;',
     'vec3 sfOrig=diffuseColor.rgb;',
     'float sfMaximum=max(max(sfOrig.r,sfOrig.g),sfOrig.b);',
     'float sfMinimum=min(min(sfOrig.r,sfOrig.g),sfOrig.b);',
     'float sfMask=(1.0-smoothstep(.12,.29,sfMaximum-sfMinimum))*smoothstep(.08,.20,sfMaximum);',
     'float sfRelief=clamp(.79+.38*dot(sfOrig,vec3(.2126,.7152,.0722)),.78,1.11);',
     'diffuseColor.rgb=mix(sfOrig,sfPaint*sfRelief,.88*sfMask);'
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
 root.userData.sandforgeFinalHqFinish=FINAL_HQ_FINISH;
 return true;
}
