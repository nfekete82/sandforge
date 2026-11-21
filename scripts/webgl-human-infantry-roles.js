import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * Visual-only role identity on the shared animated human infantry base.
 *
 * These pieces follow existing Atlas joint attachment groups. Do NOT touch
 * weapon sockets, rifle grips, animation clips, physics or unit selection.
 * All geometry/materials are shared across actors and remain tiny at RTS zoom.
 */
export const HUMAN_INFANTRY_ROLES_REVISION='human-infantry-roles-v1-20261122';
export const HUMAN_INFANTRY_ROLES=Object.freeze([
 'infantry','medic','engineer','heavy','rocket'
]);
const rounded=new RoundedBoxGeometry(1,1,1,2,.09);
const sphere=new THREE.SphereGeometry(1,12,8);
const materials={
 sand:new THREE.MeshStandardMaterial({name:'SF_Role_SandNylon',color:'#a9a084',roughness:.96}),
 olive:new THREE.MeshStandardMaterial({name:'SF_Role_OlivePouch',color:'#666c53',roughness:.94}),
 dark:new THREE.MeshStandardMaterial({name:'SF_Role_Webbing',color:'#343833',roughness:.95}),
 gold:new THREE.MeshStandardMaterial({name:'SF_Role_EngineerOchre',color:'#c49a45',roughness:.88}),
 white:new THREE.MeshStandardMaterial({name:'SF_Role_MedicIvory',color:'#e1dfc8',roughness:.96}),
 medical:new THREE.MeshStandardMaterial({name:'SF_Role_MedicalGreen',color:'#20896f',roughness:.94}),
 blue:new THREE.MeshStandardMaterial({name:'SF_Role_TeamBlue',color:'#3282ad',roughness:.87}),
 red:new THREE.MeshStandardMaterial({name:'SF_Role_TeamRed',color:'#97483c',roughness:.87})
};
function part(parent,name,material,pos,scale,geo=rounded){
 const mesh=new THREE.Mesh(geo,material);
 mesh.name='SF_Role_'+name;
 mesh.position.set(...pos);mesh.scale.set(...scale);
 mesh.userData={factionAccent:true,visualOnly:true,nonPlayable:true,
  sandforgeHumanRole:true,sandforgeSharedToolMesh:true};
 mesh.castShadow=false;mesh.receiveShadow=true;mesh.raycast=()=>{};
 parent.add(mesh);return mesh;
}
function makeCross(parent,prefix,x,y,z,scale=1){
 part(parent,prefix+'Back',materials.white,[x,y,z],[.117*scale,.120*scale,.023]);
 part(parent,prefix+'Vertical',materials.medical,[x,y,z+.015],[.027*scale,.075*scale,.009]);
 part(parent,prefix+'Horizontal',materials.medical,[x,y,z+.018],[.079*scale,.025*scale,.010]);
}
/**
 * Called AFTER humanizeInfantry(model) has removed Atlas robot armour, BEFORE
 * the role-specific engineer wrench/medic bag/rocket launcher gets installed.
 */
export function decorateHumanInfantryRole(model,role,owner=0){
 if(!model||!HUMAN_INFANTRY_ROLES.includes(role))return false;
 if(model.userData?.sandforgeHumanRoleRevision===HUMAN_INFANTRY_ROLES_REVISION&&
    model.userData?.sandforgeHumanRole===role)return true;
 // Never attach human role kit to a non-human/old unrecognized GLB.
 if(!model.userData?.sandforgeHumanInfantryRevision)return false;
 const chest=model.getObjectByName('Atlas_Breastplate');
 const pack=model.getObjectByName('Atlas_PowerPack');
 const head=model.getObjectByName('Atlas_Helmet');
 if(!chest||!pack||!head)return false;
 const team=owner===1?materials.red:materials.blue;
 if(role==='medic'){
  // The imported medic's old chest symbol was intentionally hidden when
  // replacing robotic armour. Restore readable green/white field insignia.
  makeCross(chest,'MedicChestCross',0,.002,.237,.88);
  part(chest,'MedicShoulderID',team,[-.204,.045,.093],[.030,.058,.018]);
 }else if(role==='engineer'){
  part(head,'EngineerHelmetStripe',materials.gold,[0,.151,.145],[.090,.016,.020]);
  part(chest,'EngineerVestMark',materials.gold,[.139,.053,.246],[.068,.068,.014]);
  part(pack,'EngineerToolPouch',materials.olive,[.145,-.052,-.174],
   [.125,.170,.061]);
  part(pack,'EngineerPouchLid',materials.gold,[.145,.023,-.200],
   [.129,.026,.017]);
  const belt=model.getObjectByName('Atlas_UtilityBelt');
  if(belt){
   part(belt,'EngineerToolCase',materials.olive,[-.244,-.094,.008],
    [.094,.172,.108]);
   part(belt,'EngineerCaseLatch',materials.gold,[-.244,-.022,.068],
    [.070,.023,.016]);
  }
 }else if(role==='heavy'){
  // A reinforced infantryman, NOT the former cube-shaped robot.
  for(const side of ['L','R']){
   const upper=model.getObjectByName('Atlas_UpperArm'+side);
   if(upper){
    part(upper,'HeavySoftShoulder'+side,materials.sand,[0,.035,-.009],
     [.116,.098,.112],sphere);
    part(upper,'HeavyTeamFlash'+side,team,[0,.027,.095],
     [.089,.024,.019]);
   }
  }
  for(const x of [-.126,.126])
   part(chest,'HeavyCarrierPanel'+x,materials.olive,[x,.006,.242],
    [.102,.190,.035]);
  part(pack,'HeavyRadioBattery',materials.olive,[0,-.043,-.178],
   [.216,.241,.071]);
  part(pack,'HeavyBatteryTeamTab',team,[0,-.017,-.214],
   [.093,.037,.014]);
 }else if(role==='rocket'){
  // The actual animated launcher remains owned by webgl-rocket-infantry.js.
  // Only small ammunition and identification on the moving torso are added.
  part(chest,'RocketCarrierPatch',materials.olive,[.135,.043,.243],
   [.086,.096,.027]);
  part(chest,'RocketCarrierID',team,[.135,.075,.260],
   [.073,.022,.011]);
  part(pack,'RocketReservePouch',materials.olive,[.146,-.071,-.174],
   [.112,.200,.067]);
  part(pack,'RocketPouchFlap',materials.sand,[.146,.024,-.204],
   [.115,.029,.016]);
 }
 model.userData={...model.userData,
  sandforgeHumanRoleRevision:HUMAN_INFANTRY_ROLES_REVISION,
  sandforgeHumanRole:role};
 return true;
}
