import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * Render-only upgrade of the existing animated Atlas infantry GLB.
 * Keep the original bones, clips, wrist socket, rifle and muzzle intact.
 * This deliberately does not touch Simulation, collisions, saved games or speed.
 *
 * The authored Atlas armour is attached to animated joints as separate meshes,
 * so every replacement is parented to the SAME moving joint. No new mixer or
 * per-frame updates are needed. Shared textures/geometries avoid per-unit GPU
 * resource growth.
 */
export const HUMAN_INFANTRY_REVISION='sandforge-human-rifleman-v1-20261121';

const ellipsoid=new THREE.SphereGeometry(1,20,14);
const rounded=new RoundedBoxGeometry(1,1,1,3,.13);
const dark=new THREE.MeshStandardMaterial({
 name:'SF_Human_RubberWebbing',color:'#31352f',roughness:.93,metalness:.015
});
const skin=new THREE.MeshStandardMaterial({
 name:'SF_Human_Face',color:'#aa8166',roughness:.91,metalness:0
});
const goggles=new THREE.MeshStandardMaterial({
 name:'SF_Human_GoggleGlass',color:'#303c39',roughness:.23,metalness:.12
});
const hardware=new THREE.MeshStandardMaterial({
 name:'SF_Human_BuckledSteel',color:'#62675b',roughness:.68,metalness:.36
});
const teamMats=[
 new THREE.MeshStandardMaterial({name:'SF_Human_BlueArmband',color:'#2b6685',roughness:.89}),
 new THREE.MeshStandardMaterial({name:'SF_Human_RedArmband',color:'#97483c',roughness:.89})
];
const hash=(x,y)=>{let n=Math.imul(x+47,73856093)^Math.imul(y+31,19349663);
 n=Math.imul(n^(n>>>15),2246822519);return (n^(n>>>13))>>>0;};
function desertWeave(){
 const n=128,rgba=new Uint8Array(n*n*4);
 const palette=[[190,178,145],[143,143,110],[109,111,86],[210,196,162]];
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  // Two spatial frequencies, with fine, deterministic fabric grain.
  const large=hash(x>>4,y>>4),small=hash(x>>2,y>>2);
  const index=((large>>>8)+(small>>>5))%palette.length;
  const color=palette[index],grain=(hash(x,y)&15)-8,k=(y*n+x)*4;
  for(let c=0;c<3;c++)rgba[k+c]=Math.min(255,Math.max(0,color[c]+grain));
  rgba[k+3]=255;
 }
 const map=new THREE.DataTexture(rgba,n,n,THREE.RGBAFormat);
 map.name='SF_Human_DesertFabric';
 map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;
 map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;
 map.generateMipmaps=true;map.needsUpdate=true;return map;
}
const fabric=desertWeave();
const uniform=new THREE.MeshStandardMaterial({
 name:'SF_Human_DesertCombatUniform',map:fabric,roughness:.98,metalness:0
});
const vest=new THREE.MeshStandardMaterial({
 name:'SF_Human_TacticalPlateCarrier',map:fabric,color:'#d2cbb6',
 roughness:.94,metalness:.015
});
const helmetFabric=new THREE.MeshStandardMaterial({
 name:'SF_Human_CombatHelmetCover',map:fabric,color:'#ded2ba',
 roughness:.96,metalness:0
});
const mount=(parent,name,geometry,material,position,scale,rotation=null)=>{
 const mesh=new THREE.Mesh(geometry,material);
 mesh.name='SF_Human_'+name;
 mesh.position.set(...position);mesh.scale.set(...scale);
 if(rotation)mesh.rotation.set(...rotation);
 mesh.userData={visualOnly:true,nonPlayable:true,factionAccent:true,
  sandforgeHumanInfantry:true,sandforgeSharedToolMesh:true};
 mesh.castShadow=false;mesh.receiveShadow=true;
 mesh.raycast=()=>{};
 parent.add(mesh);return mesh;
};
const oval=(parent,name,mat,pos,size)=>mount(parent,name,ellipsoid,mat,pos,size);
const shaped=(parent,name,mat,pos,size,rot=null)=>mount(parent,name,rounded,mat,pos,size,rot);
const hideChildren=parent=>{for(const node of parent.children)if(node.isMesh)node.visible=false;};
const hideNamed=(root,pattern)=>{
 root.traverse(node=>{if(node.isMesh&&pattern.test(node.name))node.visible=false;});
};
/** Repeated calls on the same GLB clone are idempotent. */
export function humanizeInfantry(model,owner=0){
 if(!model)return false;
 if(model.userData?.sandforgeHumanInfantryRevision===HUMAN_INFANTRY_REVISION)return true;
 const head=model.getObjectByName('Atlas_Helmet');
 const chest=model.getObjectByName('Atlas_Breastplate');
 const abdomen=model.getObjectByName('Atlas_AbdominalLames');
 const pack=model.getObjectByName('Atlas_PowerPack');
 const shoulders=['L','R'].map(s=>model.getObjectByName('Atlas_UpperArm'+s));
 // A missing joint signals a different/older GLB; leave that mesh untouched.
 if(!head||!chest||!abdomen||!pack||shoulders.some(s=>!s))return false;
 const faction=teamMats[owner===1?1:0];

 // Remove the sealed sci-fi visor, metallic jaw and enlarged ear mechanisms.
 // The replacement follows the existing HEAD bone during ALL clips.
 hideChildren(head);
 oval(head,'Face',skin,[0,-.046,.104],[.137,.154,.115]);
 oval(head,'Nose',skin,[0,-.080,.214],[.022,.033,.026]);
 oval(head,'HelmetCrown',helmetFabric,[0,.100,-.009],[.209,.139,.192]);
 shaped(head,'HelmetBrow',helmetFabric,[0,.070,.143],[.350,.044,.128]);
 shaped(head,'GoggleFrame',dark,[0,-.009,.205],[.300,.070,.045]);
 for(const side of [-1,1]){
  oval(head,'GoggleLens'+side,goggles,[side*.073,-.004,.231],[.064,.023,.012]);
  oval(head,'EarProtector'+side,dark,[side*.196,-.027,-.027],[.025,.073,.078]);
  shaped(head,'ChinStrap'+side,dark,[side*.112,-.123,.152],
   [.019,.018,.136],[side*.14,side*.13,0]);
 }
 shaped(head,'HelmetFrontPatch',faction,[0,.125,.161],[.086,.012,.026]);

 // A human torso and short vest replace the square robot chest armour.
 hideChildren(chest);
 shaped(chest,'Jacket',uniform,[0,0,0],[.510,.385,.305]);
 shaped(chest,'PlateCarrier',vest,[0,.005,.149],[.436,.318,.137]);
 for(const side of [-1,1]){
  shaped(chest,'Harness'+side,dark,[side*.177,.015,.224],[.034,.326,.036]);
 }
 for(const x of [-.135,0,.135]){
  shaped(chest,'MagazinePouch'+x,vest,[x,-.064,.256],[.110,.129,.082]);
  shaped(chest,'PouchFlap'+x,dark,[x,-.005,.300],[.106,.018,.012]);
 }
 shaped(chest,'VestBuckle',hardware,[0,.099,.231],[.075,.031,.019]);
 hideChildren(abdomen);
 shaped(abdomen,'JacketWaist',uniform,[0,.016,.023],[.426,.224,.268]);

 // Toned-down cloth rucksack; remove exposed sci-fi cooling fins/antenna.
 hideChildren(pack);
 shaped(pack,'RadioRucksack',uniform,[0,-.016,-.061],[.300,.348,.174]);
 shaped(pack,'RucksackPocket',vest,[0,-.080,-.164],[.215,.155,.051]);

 // Preserve the actual sleeve/forearm rig and its skinning, but remove the
 // giant shoulder armour and ceramic shin/thigh plating. Identification lives
 // on the moving upper arms, not as floating world-space flags.
 hideNamed(model,/^Atlas_(Pauldron|PauldronRim|PauldronBadge|ForearmPlate|ThighCeramic|ThighStripe|ShinRim|ShinCeramic)$/);
 for(let i=0;i<shoulders.length;i++){
  oval(shoulders[i],'SleeveArmband'+i,faction,[0,.015,0],[.109,.058,.107]);
 }
 for(const side of ['L','R']){
  const knee=model.getObjectByName('Atlas_Knee'+side);
  const cap=knee?.getObjectByName('Atlas_KneeCap');
  if(cap)cap.scale.multiplyScalar(.77);
 }
 // Do not rebind or touch Atlas_WeaponSocket / Atlas_Rifle / Atlas_MuzzleBore.
 model.userData={...model.userData,sandforgeHumanInfantryRevision:HUMAN_INFANTRY_REVISION};
 return true;
}