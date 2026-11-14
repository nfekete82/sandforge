import * as THREE from 'three';
import {addFinalHeadquartersRoofDetails} from './webgl-final-hq-roof.js';
import {decodeFinalHqCamouflage,FINAL_HQ_CAMO_COLORS,FINAL_HQ_PATTERN_WIDTH,FINAL_HQ_PATTERN_HEIGHT} from './webgl-final-hq-pattern.js';

/** Genuine user's reference pattern: model-locked, not world-projected.
 * The original UV map still supplies photorealistic wear, windows and grilles.
 */
export const FINAL_HQ_FINISH='final-feldkommando-local-desert-v4';
export {FINAL_HQ_CAMO_COLORS,FINAL_HQ_PATTERN_WIDTH,FINAL_HQ_PATTERN_HEIGHT};
let texture;
export function finalHqCamouflageTexture(){
 if(texture)return texture;
 texture=new THREE.DataTexture(decodeFinalHqCamouflage(),FINAL_HQ_PATTERN_WIDTH,
  FINAL_HQ_PATTERN_HEIGHT,THREE.RGBAFormat);
 texture.name='Supplied_Desert_Camouflage_Model_Locked';
 texture.wrapS=texture.wrapT=THREE.MirroredRepeatWrapping;
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.magFilter=THREE.LinearFilter;
 texture.minFilter=THREE.LinearMipmapLinearFilter;
 texture.generateMipmaps=true;texture.anisotropy=8;
 texture.needsUpdate=true;return texture;
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
     '#include <common>\nvarying vec3 sfFinalLocal; varying vec3 sfFinalLocalNormal;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
     '#include <begin_vertex>\nsfFinalLocal=transformed;sfFinalLocalNormal=normalize(normal);');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
     '#include <common>\nvarying vec3 sfFinalLocal; varying vec3 sfFinalLocalNormal; uniform sampler2D sfFinalCamoTex;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',[
    '#include <color_fragment>',
    // Model-local projections: preview translation, yaw and scaling cannot
    // shift the pattern. All faces retain a consistent fixed orientation.
    'vec3 sfAxis=pow(abs(normalize(sfFinalLocalNormal)),vec3(5.0));',
    'sfAxis/=max(dot(sfAxis,vec3(1.0)),.001);',
    'vec3 sfPaint=texture2D(sfFinalCamoTex,(sfFinalLocal.zy+vec2(.11,.07))*1.18).rgb*sfAxis.x',
    '+texture2D(sfFinalCamoTex,(sfFinalLocal.xy+vec2(.12,.08))*1.18).rgb*sfAxis.z',
    '+texture2D(sfFinalCamoTex,(sfFinalLocal.xz+vec2(.05,.11))*1.18).rgb*sfAxis.y;',
    'vec3 sfOrig=diffuseColor.rgb;',
    'float sfLum=dot(sfOrig,vec3(.2126,.7152,.0722));',
    'float sfChroma=max(max(sfOrig.r,sfOrig.g),sfOrig.b)-min(min(sfOrig.r,sfOrig.g),sfOrig.b);',
    'float sfBlue=smoothstep(.04,.14,sfOrig.b-max(sfOrig.r,sfOrig.g));',
    'float sfStarWhite=smoothstep(.79,.93,sfLum)*(1.0-smoothstep(.018,.07,sfChroma));',
    'float sfRoof=smoothstep(.58,.82,abs(sfFinalLocalNormal.y));',
    // The expensive original baked albedo remains sharp for windows,
    // screws, slots, door trim and seams. Paint primarily broad walls.
    'float sfSurface=smoothstep(.19,.42,sfLum);',
    'float sfWallPaint=sfSurface*(1.0-sfBlue)*(1.0-sfStarWhite)',
    '*mix(.87,.12,sfRoof);',
    'sfPaint=sfPaint*.87+vec3(.073,.065,.055);',
    'float sfShading=clamp(.93+.18*(sfLum-.5),.88,1.05);',
    'vec3 sfResult=mix(sfOrig,sfPaint*sfShading,sfWallPaint);',
    // Roof decks stay matte sand/metal instead of random brown blotches.
    'sfResult=mix(sfResult,sfResult*vec3(.83,.82,.78),sfRoof*.25*sfSurface);',
    // Keep the distinctive central/tower blue stars while muting cladding.
    'float sfTowerFlag=smoothstep(.085,.135,sfFinalLocal.y);',
    'float sfFrontFlag=smoothstep(.19,.265,sfFinalLocal.z)',
    '*smoothstep(.045,.14,sfFinalLocal.x)*(1.0-smoothstep(.26,.33,sfFinalLocal.x));',
    'float sfKeepBlue=clamp(sfTowerFlag+sfFrontFlag,0.0,1.0);',
    'vec3 sfDesertSteel=mix(sfPaint,vec3(.22,.26,.26),.34);',
    'sfResult=mix(sfResult,sfDesertSteel,sfBlue*.71*(1.0-sfKeepBlue));',
    'diffuseColor.rgb=clamp(sfResult,0.0,1.0);'
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
