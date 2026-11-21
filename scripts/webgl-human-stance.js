import * as THREE from 'three';
import {findTrouserRig} from './webgl-human-skinned-trousers.js';

/**
 * A restrained, reversible secondary pose over the existing GLB animation.
 *
 * Every update restores the previous authored pose BEFORE AnimationMixer
 * evaluates, then adds a tiny, readable lower-body stance AFTER it evaluates.
 * No changes to the original clips, upper-body IK, rifle, muzzle, collisions,
 * navigation or unit physics. Never replace the walk/run animation itself.
 */
export const HUMAN_STANCE_REVISION='human-infantry-stance-v1-20261122';
const AXIS_X=new THREE.Vector3(1,0,0);
const AXIS_Z=new THREE.Vector3(0,0,1);
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

function findLegBones(root){
 // Reuse the proven anatomical rig resolver: Quaternius, Mixamo and
 // exported Atlas attachment parents must behave identically here.
 const bones=findTrouserRig(root);
 if(!bones)return [null,null];
 return [0,1].map(i=>({
  side:i===0?'L':'R',
  upper:bones[i*3],
  knee:bones[i*3+1],
  foot:bones[i*3+2]
 }));
}
function poseJoint(bone){
 return {bone,original:new THREE.Quaternion(),delta:new THREE.Quaternion(),
  modified:false};
}
export function createHumanStance(root){
 if(!root||root.userData?.sandforgeHumanStance)return root?.userData?.sandforgeHumanStance??null;
 const legs=findLegBones(root);
 if(legs.some(l=>!l))return null; // no harm to static or legacy GLBs
 root.updateMatrixWorld(true);
 const x0=legs[0].upper.getWorldPosition(new THREE.Vector3()).x;
 const x1=legs[1].upper.getWorldPosition(new THREE.Vector3()).x;
 const centre=(x0+x1)/2;
 const pose={
  model:root,
  legs:legs.map((l,i)=>({
   upper:poseJoint(l.upper),knee:poseJoint(l.knee),foot:poseJoint(l.foot),
   outward:Math.sign((i===0?x0:x1)-centre)||(i===0?-1:1),
   phase:i===0?0:Math.PI
  })),
  movingBlend:0,
  elapsed:0,
  modified:false
 };
 root.userData.sandforgeHumanStance=pose;
 return pose;
}
/** Must run before mixer.update, including before clip crossfades. */
export function restoreHumanStance(pose){
 if(!pose?.modified)return false;
 for(const leg of pose.legs)for(const part of [leg.upper,leg.knee,leg.foot]){
  if(part.modified){part.bone.quaternion.copy(part.original);part.modified=false;}
 }
 pose.modified=false;
 return true;
}
function applyJoint(joint,x,z){
 joint.original.copy(joint.bone.quaternion);
 if(x!==0){
  joint.delta.setFromAxisAngle(AXIS_X,x);
  joint.bone.quaternion.multiply(joint.delta);
 }
 if(z!==0){
  joint.delta.setFromAxisAngle(AXIS_Z,z);
  joint.bone.quaternion.multiply(joint.delta);
 }
 joint.modified=x!==0||z!==0;
}
/**
 * Call only after AnimationMixer.update. Phase is the actual GLB Run_Gun clip
 * progress, so movement follows existing steps rather than inventing a second
 * walk cycle. On shooting preserve a solid braced stance; on hit/death do none.
 */
export function applyHumanStance(pose,{moving=false,shooting=false,hurt=false,
 death=false,dt=0,walkPhase=0}={}){
 if(!pose)return false;
 // Defensive: previous secondary offsets never accumulate on the skeleton.
 restoreHumanStance(pose);
 if(death||hurt)return false;
 dt=clamp(Number.isFinite(dt)?dt:0,0,.08);
 pose.elapsed+=dt;
 const target=moving?1:0;
 pose.movingBlend+=(target-pose.movingBlend)*clamp(dt*6,0,1);
 const run=pose.movingBlend,idle=1-run;
 const breath=Math.sin(pose.elapsed*2.15);
 const cycle=(Number.isFinite(walkPhase)?walkPhase:0)*Math.PI*2;
 // On fire, attenuate leg corrections so the original two-hand rifle
 // animation and authoritative muzzle heading retain visual precedence.
 const strength=shooting?.42:1;
 for(const leg of pose.legs){
  const stride=Math.sin(cycle+leg.phase);
  const sideShift=-leg.outward*(.034*idle+.010*run);
  const idleShift=leg.outward*.007*breath*idle;
  const upperPitch=(-.029*idle+.024*run*stride)*strength;
  const kneeBend=(.058*idle+.020*run+.014*run*Math.max(0,-stride))*strength;
  // Compensate the boot for the deliberately subtle new knee flexion.
  const anklePitch=-(upperPitch+kneeBend)*.63;
  applyJoint(leg.upper,upperPitch,sideShift+idleShift);
  applyJoint(leg.knee,kneeBend,0);
  applyJoint(leg.foot,anklePitch,0);
 }
 pose.modified=true;
 return true;
}
export function disposeHumanStance(pose){
 if(!pose)return false;
 restoreHumanStance(pose);
 if(pose.model?.userData?.sandforgeHumanStance===pose)
  delete pose.model.userData.sandforgeHumanStance;
 return true;
}
