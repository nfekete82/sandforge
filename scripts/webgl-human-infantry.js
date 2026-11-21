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
export const HUMAN_INFANTRY_REVISION='sandforge-human-rifleman-v6-proportioned-stature-20261121';

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
 // Shadows only for the 10–12 major silhouette pieces, never 60 tiny straps,
 // fingers or laces; keep the existing battlefield shadow budget intact.
 mesh.castShadow=/^(Face|HelmetCrown|Jacket|PlateCarrier|RadioRucksack|sleeve[LR]|forearm[LR]|thigh[LR]|calf[LR]|CombatBootToe[LR])$/.test(name);
 mesh.receiveShadow=true;
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
  sleeve:[1.02,1.01,.98,.93,.88,.85,.84,.88,.91],
  forearm:[1.01,.99,.96,.91,.84,.78,.74,.75,.80],
  thigh:[1.01,1.03,1.06,1.02,.98,.91,.86,.87,.91],
  calf:[.94,.92,.91,.89,.91,.94,.97,1.01,1.03]
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
 // A trouser leg is wider than a forearm, but never twice its bone width.
 // Previous .71/.69 radii made both thighs look like pneumatic robot armour.
 const widths={
  sleeve:[.61,.61],forearm:[.55,.54],thigh:[.56,.57],calf:[.54,.55]
 }[profile];
 mount(joint,profile+side,garment[profile],
  uniform,[0,0,0],
  [size.x*widths[0],size.y*1.17,size.z*widths[1]]);
 if(profile==='forearm')
  mount(joint,'RolledSleeveCuff'+side,garment.sleeve,uniform,
   [0,-size.y*.44,0],[size.x*.62,size.y*.12,size.z*.60]);
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
 oval(head,'Face',skin,[0,-.044,.102],[.129,.147,.109]);
 oval(head,'Nose',skin,[0,-.080,.208],[.018,.029,.020]);
 oval(head,'HelmetCrown',helmetFabric,[0,.091,-.009],[.190,.120,.179]);
 shaped(head,'HelmetBrow',helmetFabric,[0,.066,.141],[.315,.039,.119]);
 shaped(head,'GoggleFrame',dark,[0,-.011,.201],[.270,.059,.037]);
 for(const side of [-1,1]){
  oval(head,'GoggleLens'+side,goggles,[side*.068,-.009,.226],[.057,.019,.010]);
  oval(head,'EarProtector'+side,dark,[side*.188,-.027,-.027],[.020,.058,.064]);
  shaped(head,'ChinStrap'+side,dark,[side*.112,-.123,.152],
   [.019,.018,.136],[side*.14,side*.13,0]);
 }
 shaped(head,'HelmetFrontPatch',faction,[0,.119,.156],[.068,.010,.018]);

 // A human torso and short vest replace the square robot chest armour.
 hideChildren(chest);
 oval(chest,'Jacket',uniform,[0,0,-.003],[.250,.209,.162]);
 shaped(chest,'PlateCarrier',vest,[0,.015,.145],[.382,.266,.111]);
 for(const side of [-1,1]){
  shaped(chest,'Harness'+side,dark,[side*.168,.018,.214],[.028,.293,.031]);
 }
 for(const x of [-.135,0,.135]){
  shaped(chest,'MagazinePouch'+x,vest,[x,-.057,.232],[.090,.092,.050]);
  shaped(chest,'PouchFlap'+x,dark,[x,-.008,.259],[.088,.012,.008]);
 }
 shaped(chest,'VestBuckle',hardware,[0,.099,.222],[.070,.025,.015]);
 // Close the armpit gap while the animated arms swing: fabric, not rigid
 // shoulder plates. These caps stay with the torso, sleeves with arm bones.
 for(const side of [-1,1])
  oval(chest,'ShoulderFabric'+side,uniform,
   [side*.224,.078,-.008],[.080,.087,.091]);
 hideChildren(abdomen);
 oval(abdomen,'JacketWaist',uniform,[0,.027,.015],[.204,.124,.133]);
 // Bridge the gap between abdominal cloth and the animated upper legs.
 // The original belt is a large metallic-looking straight-edged block.
 const hips=model.getObjectByName('Atlas_UtilityBelt');
 if(hips){
  hideChildren(hips);
  oval(hips,'TrouserHips',uniform,[0,-.075,.008],[.211,.119,.137]);
  shaped(hips,'EquipmentBelt',dark,[0,.031,.032],[.414,.048,.243]);
  shaped(hips,'BeltBuckle',hardware,[0,.031,.175],[.068,.045,.019]);
 }
 // Remove the black, spherical robot-like neck and keep a short human collar.
 const neck=model.getObjectByName('Atlas_NeckSeal');
 if(neck){
  hideChildren(neck);
  oval(neck,'HumanNeck',skin,[0,.008,.051],[.078,.100,.077]);
  shaped(neck,'ShirtCollar',uniform,[0,-.052,.055],[.218,.055,.168]);
 }

 // Toned-down cloth rucksack; remove exposed sci-fi cooling fins/antenna.
 hideChildren(pack);
 // The original box silhouette dwarfed the soldier at side-view RTS zoom.
 // A shorter, rounded field bag stays clearly below the helmet.
 shaped(pack,'RadioRucksack',uniform,[0,-.037,-.045],[.219,.238,.123]);
 shaped(pack,'RucksackPocket',vest,[0,-.090,-.126],[.168,.098,.036]);

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
   oval(knee,'TrouserKnee'+side,uniform,[0,0,.020],[.087,.100,.089]);
   shaped(knee,'SoftKneepad'+side,vest,[0,-.008,.102],
    [.091,.068,.020]);
   shaped(knee,'KneeStrap'+side,dark,[0,-.044,.099],
    [.096,.009,.013]);
  }

  const boot=model.getObjectByName('Atlas_Boot'+side);
  if(boot){
   hideChildren(boot);
   // Narrow ankle and shaped rounded toe, not huge square robot feet.
   oval(boot,'CombatBootAnkle'+side,dark,[0,.050,-.009],
    [.079,.109,.079]);
   oval(boot,'CombatBootToe'+side,dark,[0,-.009,.106],
    [.085,.050,.113]);
   shaped(boot,'CombatBootSole'+side,dark,[0,-.054,.029],
    [.174,.024,.277]);
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
    [side==='R'?.015:-.015,.008,.023],[.047,.048,.053]);
  }

  const thigh=model.getObjectByName('Atlas_Thigh'+side);
  if(thigh){
   const sign=side==='L'?1:-1;
   shaped(thigh,'CargoPocket'+side,vest,
    [sign*.083,-.006,.051],[.040,.073,.038]);
   shaped(thigh,'CargoPocketFlap'+side,vest,
    [sign*.083,.034,.051],[.041,.010,.040]);
  }
 }
 // Remove the remaining ceramic belt pouches without losing the functional
 // strap and buckle. All rifle and IK wrist anchors remain untouched.
 hideNamed(model,/^Atlas_(AmmoPouch|PouchLid|PouchFastener)$/);
 // Make the entire articulated human slightly taller without moving any
 // bones relative to the two-hand rifle: the old torso/legs read as a squat
 // toy at normal RTS zoom. Apply to this model clone once before battlefield
 // normalizes the GLB bounds; collision and unit scale remain authoritative.
 // Scaling the WHOLE animated root keeps every grip, recoil and muzzle aligned.
 model.scale.y*=1.095;
 // Do not rebind or touch Atlas_WeaponSocket / Atlas_Rifle / Atlas_MuzzleBore.
 model.userData={...model.userData,sandforgeHumanInfantryRevision:HUMAN_INFANTRY_REVISION};
 return true;
}