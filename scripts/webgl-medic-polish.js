import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * Sandforge medic visual overhaul. Attach to Atlas's animated helmet, shoulders
 * and backpack rather than to the static actor group: no floating patches when
 * walking, shooting, turning or falling. The game/simulation rig is untouched.
 * Shared matte geometries/materials mean no new per-frame allocations.
 */
export const MEDIC_ART_REVISION='matte-field-medic-v2-human-proportions-20261122';
const materials={
 ceramic:new THREE.MeshStandardMaterial({name:'Medic warm ceramic',color:'#f0e9d8',roughness:.94,metalness:0}),
 white:new THREE.MeshStandardMaterial({name:'Medic clean medical white',color:'#faf5e8',roughness:.95,metalness:0}),
 green:new THREE.MeshStandardMaterial({name:'Medic nonemissive emerald',color:'#178c68',roughness:.91,metalness:0}),
 charcoal:new THREE.MeshStandardMaterial({name:'Medic matte field webbing',color:'#33322c',roughness:.97,metalness:0}),
 strap:new THREE.MeshStandardMaterial({name:'Medic sand straps',color:'#ae9c82',roughness:.96,metalness:0}),
 steel:new THREE.MeshStandardMaterial({name:'Medic dark buckles',color:'#69675d',roughness:.94,metalness:.02})
};
const cachedGeometry=new Map();
function boxGeometry(w,h,d,r=0){
 const key=[w,h,d,r].join(':');
 if(!cachedGeometry.has(key))cachedGeometry.set(key,
  r?new RoundedBoxGeometry(w,h,d,2,r):new THREE.BoxGeometry(w,h,d));
 return cachedGeometry.get(key);
}
function part(parent,name,size,material,position,r=0){
 const mesh=new THREE.Mesh(boxGeometry(...size,r),materials[material]);
 mesh.name='SF_Medic_'+name;
 mesh.position.set(...position);
 mesh.castShadow=true;mesh.receiveShadow=true;
 // Preserve green/white medic markings when faction blue/red is applied.
 mesh.userData={factionAccent:true,medicArt:true,nonPlayable:true};
 mesh.raycast=()=>{};
 parent.add(mesh);
 return mesh;
}
function cross(parent,label,origin,plane='xy',scale=1){
 const [x,y,z]=origin;
 const normal=plane==='yz'?[.012,.115,.032]:[.073,.195,.013];
 const lateral=plane==='yz'?[.012,.034,.109]:[.20,.068,.014];
 part(parent,label+'Vertical',normal.map(v=>v*scale),'green',[x,y,z]);
 part(parent,label+'Horizontal',lateral.map(v=>v*scale),'green',[x,y,z]);
}
function addPack(pack){
 // The original upper backpack antenna uses a high-emissive amber tip and
 // steel trim: this was the bright/glittering pixel above the medic's pack.
 // Hide just the old backpack shell/decor, keep the animated torso rig.
 for(const node of pack.children){
  // The common human soldier's small radio pack is replaced by the medic
  // satchel, never rendered twice inside the same torso silhouette.
  if(/^Atlas_(MedicalSatchel|MedicalPackFlap|MedicalCross|MedicalSideKit|MedicalKitStripe|PackStripe|CoolingFin|Antenna)/.test(node.name)||
    /^SF_Human_(RadioRucksack|RucksackPocket|RucksackTeamTab)/.test(node.name))
   node.visible=false;
 }
 part(pack,'FieldMedicalCase',[.415,.425,.255],'ceramic',[0,-.021,-.083],.035);
 part(pack,'FieldMedicalRearPanel',[.397,.353,.018],'white',[0,-.021,-.221],.012);
 cross(pack,'BackpackCross',[0,-.021,-.240],'xy',.98);
 part(pack,'MatteZipLid',[.442,.079,.283],'charcoal',[0,.201,-.083],.018);
 for(const x of [-.13,.13]){
  part(pack,'LidStrap'+x,[.038,.014,.295],'strap',[x,.258,-.083],.003);
  part(pack,'LidBuckle'+x,[.052,.034,.018],'steel',[x,.215,-.236],.005);
 }
 // Side medical instruments: readable silhouette, no glowing vials.
 for(const x of [-.263,.263]){
  part(pack,'SideAidPouch'+x,[.105,.203,.155],x<0?'white':'ceramic',[x,-.084,-.083],.022);
  part(pack,'SideKitTop'+x,[.107,.040,.16],'charcoal',[x,.025,-.083],.009);
 }
 cross(pack,'SidePouchCross',[-.263,-.084,-.168],'xy',.35);
 const vial=new THREE.Mesh(new THREE.CylinderGeometry(.051,.051,.22,9),materials.ceramic);
 vial.name='SF_Medic_SupplyCanister';vial.position.set(.346,-.10,-.083);vial.scale.setScalar(.8);
 vial.userData={factionAccent:true,medicArt:true,nonPlayable:true};
 vial.castShadow=true;vial.raycast=()=>{};pack.add(vial);
 part(pack,'CanisterGreenBand',[.092,.037,.092],'green',[.346,-.130,-.083],.005);
 // Rolled bandage secured under the kit. Everything is torso/bone anchored.
 const roll=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,.43,10),materials.ceramic);
 roll.name='SF_Medic_BandageRoll';roll.rotation.z=Math.PI/2;
 roll.position.set(0,-.293,-.103);roll.scale.setScalar(.82);roll.castShadow=true;
 roll.userData={factionAccent:true,medicArt:true,nonPlayable:true};
 roll.raycast=()=>{};pack.add(roll);
 for(const x of [-.13,.13])
  part(pack,'RollStrap'+x,[.041,.132,.146],'charcoal',[x,-.293,-.103],.005);
 // Matched matte antenna, without the old emissive/reflective sparkle.
 const antenna=new THREE.Mesh(new THREE.CylinderGeometry(.008,.009,.22,7),materials.charcoal);
 antenna.name='SF_Medic_MatteAntenna';antenna.position.set(.148,.34,-.094);
 antenna.userData={factionAccent:true,medicArt:true,nonPlayable:true};
 antenna.raycast=()=>{};pack.add(antenna);
}
function addHelmet(helmet){
 const original=helmet.getObjectByName('Atlas_HelmetStripe');
 if(original){original.position.z=.143;original.scale.z=.33;}
 part(helmet,'HelmetMedicStripe',[.087,.020,.22],'green',[0,.224,-.036],.008);
 for(const side of [-1,1])
  cross(helmet,'HelmetCross'+side,[side*.209,.055,-.046],'yz',.68);
}
function addArmBands(model){
 for(const side of ['L','R']){
  const arm=model.getObjectByName('Atlas_UpperArm'+side);
  if(!arm)continue;
  part(arm,'Armband'+side,[.235,.13,.023],'white',[0,-.035,.156],.006);
  cross(arm,'ArmCross'+side,[0,-.035,.173],'xy',.37);
 }
}
/** Idempotent; returns false for unrelated 3D models or old non-Atlas rigs. */
export function polishMedicModel(model){
 if(!model||model.userData?.medicArtRevision===MEDIC_ART_REVISION)return false;
 const pack=model.getObjectByName('Atlas_PowerPack');
 const helmet=model.getObjectByName('Atlas_Helmet');
 if(!pack||!helmet)return false;
 addPack(pack);
 addHelmet(helmet);
 addArmBands(model);
 model.userData.medicArtRevision=MEDIC_ART_REVISION;
 return true;
}
