import * as THREE from 'three';
import {BLOOM_LAYER} from './webgl-visual-post.js';

// Bright electrical status directly on the 3D Bastion, not a territory HUD.
// Owner values are Simulation-owned: 0 blue, 1 red, otherwise neutral white.
export const BASTION_BEACON_REVISION='bastion-ownership-beacon-20261121';
export const BASTION_BEACON_COLORS=Object.freeze({
 blue:'#238dff',red:'#ff4051',neutral:'#edf8ff'
});
export const bastionOwnerLight=owner=>owner===0?
 BASTION_BEACON_COLORS.blue:owner===1?
 BASTION_BEACON_COLORS.red:BASTION_BEACON_COLORS.neutral;

/** A subtle belt and four inset status strips around the actual outpost.
 * The pieces remain attached through async GLB swaps and capture recaptures.
 * MeshBasicMaterial avoids additional PointLights, shadows and draw passes. */
export function attachBastionBeacon(node,owner){
 if(!node)return null;
 let status=node.getObjectByName('SF_Bastion_Ownership_Status');
 if(status){setBastionBeaconColor(status,owner);return status;}
 status=new THREE.Group();status.name='SF_Bastion_Ownership_Status';
 status.userData={visualOnly:true,nonPlayable:true,ownerBeacon:true,
  revision:BASTION_BEACON_REVISION};
 const material=new THREE.MeshBasicMaterial({
  color:bastionOwnerLight(owner),transparent:true,opacity:.83,
  toneMapped:false,depthWrite:false,blending:THREE.AdditiveBlending
 });
 const ring=new THREE.Mesh(new THREE.TorusGeometry(34,1.15,5,48),material);
 ring.name='SF_Bastion_Emissive_Armour_Belt';
 ring.layers.enable(BLOOM_LAYER);
 ring.rotation.x=-Math.PI/2;ring.position.y=28;
 ring.castShadow=false;ring.receiveShadow=false;ring.raycast=()=>{};
 status.add(ring);
 // Four fine light slits rather than a giant glowing cylinder.
 const stripGeometry=new THREE.BoxGeometry(2.2,11,1.2);
 for(const [x,z,rotation] of [[-31,0,Math.PI/2],[31,0,Math.PI/2],
   [0,-31,0],[0,31,0]]){
  const strip=new THREE.Mesh(stripGeometry,material);
  strip.name='SF_Bastion_Emissive_Status_Strip';
  strip.layers.enable(BLOOM_LAYER);
  strip.position.set(x,34,z);strip.rotation.y=rotation;
  strip.castShadow=false;strip.receiveShadow=false;strip.raycast=()=>{};
  status.add(strip);
 }
 node.add(status);
 return status;
}
export function setBastionBeaconColor(status,owner){
 if(!status)return;
 const color=bastionOwnerLight(owner);
 status.traverse(o=>{if(o.isMesh&&o.material?.color)o.material.color.set(color);});
 status.userData.owner=owner;
}
export function detachBastionBeacon(status){
 if(!status)return;
 const geometries=new Set(),materials=new Set();
 status.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);materials.add(o.material);}});
 status.removeFromParent();
 for(const g of geometries)g?.dispose();
 for(const m of materials)m?.dispose();
}
