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
export const HUMAN_INFANTRY_REVISION='sandforge-human-rifleman-v2-anatomical-limbs-20261121';

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

// Fabric cylinders are NOT primitive round tubes. Their irregular tapered rings,
// folds and preserved cloth UVs produce human sleeves and cargo-trouser silhouettes.
// One immutable geometry per anatomical section is shared across all infantry.
function garmentGeometry(profile){
 const positions=[],uv=[],indices=[],radial=12,rings=9;
 const taper={
  sleeve:[1.10,1.01,.91,.88,.85,.84,.84,.87,.91],
  forearm:[1.01,.99,.96,.91,.84,.78,.74,.75,.80],
  thigh:[1.10,1.06,1.02,.97,.95,.90,.84,.82,.85],
  calf:[.85,.88,.92,.96,.98,.96,.98,1.04,1.09]
 }[profile];
 for(let j=0;j<rings;j++){
  const t=j/(rings-1),fold=.025*Math.sin(t*Math.PI*8+.55);
  for(let i=0;i<radial;i++){
   const a=i/radial*Math.PI*2,r=taper[j]+fold*Math.sin(a*3+j*.61);
   const creasing=1+.030*Math.sin(a*5+j*.93)+.018*Math.cos(a*7-j*.8);
   positions.push(Math.cos(a)*r*creasing,t-.5,
    Math.sin(a)*r*(1+.027*Math.cos(j*2+a*4)));
   uv.push(i/radial*1.5,t*2.0);
  }
 }
 for(let j=0;j<rings-1;j++)for(let i=0;i<radial;i++){
  const a=j*radial+i,b=j*radial+(i+1)%radial,c=(j+1)*radial+i,d=(j+1)*radial+(i+1)%radial;
  indices.push(a,c,b,b,c,d);
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 g.setIndex(indices);g.computeVertexNormals();
 return g;
}
const garment=Object.freeze({
 sleeve:garmentGeometry('sleeve'),
 forearm:garmentGeometry('forearm'),
 thigh:garmentGeometry('thigh'),
 calf:garmentGeometry('calf')
});
const dimensions=(mesh)=>{
 if(!mesh?.geometry)return null;
 if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
 return mesh.geometry.boundingBox.getSize(new THREE.Vector3());
};
function replaceLimb(model,part,side,profile){
 const joint=model.getObjectByName('Atlas_'+part+side);
 const suit=joint?.getObjectByName('Atlas_'+part+side+'Suit');
 const size=dimensions(suit);
 if(!joint||!size)return false;
 // These rigid old pieces are responsible for the visible robot limbs.
 // They remain on their joints but are not rendered, even while running.
 joint.traverse(node=>{if(node.isMesh&&node.name.startsWith('Atlas_'))node.visible=false;});
 mount(joint,profile+side,garment[profile],
  profile==='forearm'?skin:uniform,[0,0,0],
  [size.x*.71,size.y*1.10,size.z*.69]);
 if(profile==='forearm')
  mount(joint,'RolledSleeveCuff'+side,garment.sleeve,uniform,
   [0,-size.y*.44,0],[size.x*.77,size.y*.15,size.z*.76]);
 return true;
}

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

 // Replace the ENTIRE boxy exoskeleton. Each garment section is mounted
 // on the identical Atlas upper/lower limb joint and therefore moves with
 // the established walk/run/fire/hit/death GLB animation tracks.
 for(const side of ['L','R']){
  replaceLimb(model,'UpperArm',side,'sleeve');
  replaceLimb(model,'Forearm',side,'forearm');
  replaceLimb(model,'Thigh',side,'thigh');
  replaceLimb(model,'Shin',side,'calf');

  const shoulder=model.getObjectByName('Atlas_UpperArm'+side);
  if(shoulder){
   // Cloth armband moves with the sleeve, not in world coordinates.
   mount(shoulder,'SleeveArmband'+(side==='L'?0:1),
    garment.sleeve,faction,[0,-.005,0],[.099,.065,.099]);
  }

  const knee=model.getObjectByName('Atlas_Knee'+side);
  if(knee){
   const cap=knee.getObjectByName('Atlas_KneeCap');
   if(cap)cap.scale.multiplyScalar(.77); // preserve historical size contract
   hideChildren(knee); // neither the sci-fi ball joint nor ceramic hinge
   oval(knee,'TrouserKnee'+side,uniform,[0,0,.026],[.097,.097,.096]);
   shaped(knee,'SoftKneepad'+side,vest,[0,-.002,.115],
    [.132,.102,.028]);
   shaped(knee,'KneeStrap'+side,dark,[0,-.050,.103],
    [.125,.013,.019]);
  }

  const boot=model.getObjectByName('Atlas_Boot'+side);
  if(boot){
   hideChildren(boot);
   // Narrow ankle and shaped rounded toe, not huge square robot feet.
   oval(boot,'CombatBootAnkle'+side,dark,[0,.057,-.014],
    [.085,.112,.086]);
   oval(boot,'CombatBootToe'+side,dark,[0,-.008,.114],
    [.096,.052,.123]);
   shaped(boot,'CombatBootSole'+side,dark,[0,-.056,.032],
    [.191,.026,.303]);
   for(let i=0;i<4;i++)
    shaped(boot,'BootLace'+side+i,hardware,
     [0,.074-i*.024,.073],[.058,.006,.009]);
  }

  // The existing Index1L/Index1R hand joints still own the rifle grip.
  // Leave individual gripping fingers in place; remove only hard knuckle
  // plates and rigid cuffs, replacing them with soft black tactical gloves.
  const glove=model.getObjectByName('Atlas_Glove'+side);
  if(glove){
   for(const node of glove.children)
    if(node.isMesh&&/^Atlas_(KnucklePlate|GloveCuff)/.test(node.name))
     node.visible=false;
   oval(glove,'TacticalGlove'+side,dark,
    [side==='R'?.015:-.015,.008,.023],[.053,.053,.059]);
  }

  const thigh=model.getObjectByName('Atlas_Thigh'+side);
  if(thigh){
   const sign=side==='L'?1:-1;
   shaped(thigh,'CargoPocket'+side,vest,
    [sign*.094,-.005,.052],[.052,.105,.061]);
   shaped(thigh,'CargoPocketFlap'+side,dark,
    [sign*.094,.042,.057],[.052,.013,.062]);
  }
 }
 // Remove the remaining ceramic belt pouches without losing the functional
 // strap and buckle. All rifle and IK wrist anchors remain untouched.
 hideNamed(model,/^Atlas_(AmmoPouch|PouchLid|PouchFastener)$/);
 // Do not rebind or touch Atlas_WeaponSocket / Atlas_Rifle / Atlas_MuzzleBore.
 model.userData={...model.userData,sandforgeHumanInfantryRevision:HUMAN_INFANTRY_REVISION};
 return true;
}