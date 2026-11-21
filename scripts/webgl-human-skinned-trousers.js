import * as THREE from 'three';

/**
 * One continuous, bone-weighted pair of desert cargo trousers.
 *
 * Unlike the old four independent rigid tubes, this mesh deforms across
 * BOTH knees with the existing Quaternius UpperLeg/LowerLeg/Foot bones.
 * No gameplay or animation track changes; only render-time geometry.
 *
 * A separate skin instance is required because each GLB has independent
 * skeleton bindings; mesh materials remain shared and no RAF work is added.
 */
export const SKINNED_TROUSERS_REVISION='human-articulated-cargo-pants-v3-20261122';
const TWO_PI=Math.PI*2;
const radial=16,segments=30;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const lerp=(a,b,t)=>a+(b-a)*t;
// Radii in metres, not diameters: the full hip-to-boot silhouette now has
// normal trouser width, an anatomically full knee and a shaped calf. A mild
// taper at the boot stops "two sticks" without overlarge straight tubes.
// Fuller cargo pants: subtle anatomical taper with a properly filled-out calf.
// Unlike disconnected rigid pieces, the same fabric deforms over the knee.
const profile=[
 [0.00,.184,.191],[.09,.191,.198],[.20,.188,.196],
 [.33,.178,.185],[.44,.169,.176],[.52,.172,.181],
 [.60,.179,.183],[.70,.177,.179],[.79,.169,.171],
 [.87,.160,.162],[.94,.151,.153],[1.00,.142,.144]
];
function measure(ratio,axis){
 for(let i=1;i<profile.length;i++){
  const prev=profile[i-1],next=profile[i];
  if(ratio<=next[0])return lerp(prev[axis],next[axis],
   smooth(prev[0],next[0],ratio));
 }
 return profile[profile.length-1][axis];
}
// Supports the original Quaternius bones AND conventional game-export rigs.
// Inspect actual Bone nodes only; a renamed mesh or empty group is not a rig.
const normalize=name=>String(name).toLowerCase().replace(/[^a-z0-9]/g,'')
 .replace(/^mixamorig/,'').replace(/^quaternius/,'');
const boneAliases={
 UpperLegL:['UpperLegL','LeftUpLeg','LeftUpperLeg','LeftThigh','ThighL','UpLegL'],
 LowerLegL:['LowerLegL','LeftLeg','LeftLowerLeg','LeftCalf','CalfL','LegL'],
 FootL:['FootL','LeftFoot','LeftAnkle','AnkleL'],
 UpperLegR:['UpperLegR','RightUpLeg','RightUpperLeg','RightThigh','ThighR','UpLegR'],
 LowerLegR:['LowerLegR','RightLeg','RightLowerLeg','RightCalf','CalfR','LegR'],
 FootR:['FootR','RightFoot','RightAnkle','AnkleR']
};
const descendants=(parent,child)=>{let current=child?.parent;
 while(current){if(current===parent)return true;current=current.parent;}return false;
};
// Prefer the actual animated bone that already carries the exported Atlas
// geometry. This is more reliable than guessing third-party skeleton names.
const owningBone=(model,groupName)=>{
 let node=model.getObjectByName(groupName)?.parent;
 while(node&&!node.isBone)node=node.parent;
 return node?.isBone?node:null;
};
export function findTrouserRig(model){
 const bones=[];
 model?.traverse(node=>{if(node.isBone)bones.push(node);});
 const used=new Set(),selected=[];
 for(const key of ['UpperLegL','LowerLegL','FootL',
  'UpperLegR','LowerLegR','FootR']){
  const aliases=boneAliases[key].map(normalize);
  const side=key.endsWith('L')?'L':'R';
  const slot=key.startsWith('UpperLeg')?'Thigh':key.startsWith('LowerLeg')?'Shin':'Boot';
  const anchored=owningBone(model,'Atlas_'+slot+side);
  // Canonical named bones take precedence; older exported Atlas groups can
  // have a shared parent and must not override a correct named bone.
  const joint=bones.find(b=>!used.has(b)&&aliases.includes(normalize(b.name)))||
   (anchored&&!used.has(anchored)?anchored:null);
  if(!joint)return null;
  used.add(joint);selected.push(joint);
 }
 // Reject a false left/right match or unrelated, identically named prop bones.
 if(!descendants(selected[0],selected[1])||
    !descendants(selected[1],selected[2])||
    !descendants(selected[3],selected[4])||
    !descendants(selected[4],selected[5]))return null;
 return selected;
}
function addLeg(sideIndex,hip,knee,ankle,inverse,positions,uv,weights,indices,joints){
 const start=hip.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse);
 const middle=knee.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse);
 const finish=ankle.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse);
 // Extend *down* into the boot upper, not upwards away from it.
 // Foot sockets are near the ankle. A +.075 Y lift left visible stick gaps.
 finish.y-=.020;
 const upperDistance=start.distanceTo(middle);
 const lowerDistance=middle.distanceTo(finish);
 if(upperDistance<.12||lowerDistance<.12)return false;
 const kneeT=upperDistance/(upperDistance+lowerDistance);
 const total=upperDistance+lowerDistance;
 // Foot-to-hip length scales trouser girth without changing the skeleton.
 const girth=clamp(total/1.02,1.04,1.23);
 const firstIndex=positions.length/3;
 for(let row=0;row<=segments;row++){
  const t=row/segments,top=t<=kneeT;
  const v=top?t/kneeT:(t-kneeT)/(1-kneeT);
  const center=new THREE.Vector3().lerpVectors(top?start:middle,top?middle:finish,v);
  const tangent=new THREE.Vector3().subVectors(top?middle:finish,top?start:middle).normalize();
  // Frame axes are perpendicular to the actual skeleton limb; a bent knee
  // cannot turn the pant tube into a vertical stick at export.
  const xAxis=new THREE.Vector3(1,0,0).addScaledVector(tangent,-tangent.x).normalize();
  const zAxis=new THREE.Vector3().crossVectors(tangent,xAxis).normalize();
  const rX=measure(t,1)*girth,rZ=measure(t,2)*girth;
  const upperWeight=1-smooth(kneeT-.145,kneeT+.065,t);
  const footWeight=smooth(.87,1.00,t)*(1-upperWeight);
  const lowerWeight=(1-upperWeight)-footWeight;
  for(let col=0;col<radial;col++){
   const a=TWO_PI*col/radial;
   // Folds are intentional *surface* deformation, not rigid armour bands.
   const fold=1+.045*Math.sin(a*5+t*27)+.026*Math.sin(a*8-t*39);
   const creasing=1+.010*Math.sin(t*58+a*3);
   const p=center.clone().addScaledVector(xAxis,Math.cos(a)*rX*fold)
     .addScaledVector(zAxis,Math.sin(a)*rZ*creasing);
   // A small forward knee break avoids a perfectly cylindrical "stilt".
   if(Math.abs(t-kneeT)<.11){
    const kneeBlend=1-Math.abs(t-kneeT)/.11;
    p.addScaledVector(zAxis,.018*kneeBlend);
    p.addScaledVector(xAxis,.009*Math.cos(a)*kneeBlend);
   }
   positions.push(p.x,p.y,p.z);
   uv.push(col/radial*1.6,t*(total/1.02)*2.8);
   const base=sideIndex*3;
   joints.push(base,base+1,base+2,0);
   weights.push(upperWeight,lowerWeight,footWeight,0);
  }
 }
 for(let row=0;row<segments;row++)for(let col=0;col<radial;col++){
  const a=firstIndex+row*radial+col;
  const b=firstIndex+row*radial+(col+1)%radial;
  const c=firstIndex+(row+1)*radial+col;
  const d=firstIndex+(row+1)*radial+(col+1)%radial;
  indices.push(a,b,c,b,d,c);
 }
 return true;
}
/** Returns true when an actual named, animated humanoid skeleton was found. */
export function installSkinnedTrousers(model,fabricMaterial){
 if(!model||!fabricMaterial||model.getObjectByName('SF_Human_SkinnedTrousers'))
  return false;
 const bones=findTrouserRig(model);
 if(!bones){
  model.userData.sandforgeTrouserStatus='missing-compatible-leg-bones';
  return false; // legacy GLB keeps the safe rigid fallback
 }
 model.updateMatrixWorld(true);
 const inv=model.matrixWorld.clone().invert();
 const positions=[],uv=[],skinWeight=[],skinIndex=[],triangles=[];
 for(let side=0;side<2;side++)
  if(!addLeg(side,...bones.slice(side*3,side*3+3),inv,
    positions,uv,skinWeight,triangles,skinIndex)){
   model.userData.sandforgeTrouserStatus='invalid-leg-rest-pose';
   return false;
  }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndex,4));
 geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(skinWeight,4));
 geometry.setIndex(triangles);
 geometry.computeVertexNormals();
 geometry.computeBoundingBox();
 geometry.computeBoundingSphere();

 // The inverse rest matrices are calculated from this actor's own rig.
 // This is NOT a second animated skeleton: the bones are exactly the same
 // nodes as the existing idle/walk/attack/hit/death animation tracks.
 const skeleton=new THREE.Skeleton(bones);
 const mesh=new THREE.SkinnedMesh(geometry,fabricMaterial);
 mesh.name='SF_Human_SkinnedTrousers';
 mesh.userData={visualOnly:true,nonPlayable:true,factionAccent:true,
  sandforgeHumanInfantry:true,sandforgeHumanSkinnedTrousers:true};
 // Cull actors normally: forcing every trouser into every camera frame
 // would regress late-game infantry performance. Expand only the animated
 // local bound so normal knee movement cannot cause leg pop-in.
 mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=true;
 mesh.raycast=()=>{};
 model.add(mesh);
 model.updateMatrixWorld(true);
 mesh.bind(skeleton);
 mesh.computeBoundingSphere();
 if(mesh.boundingSphere)mesh.boundingSphere.radius*=1.50;
 // Keep owned instance resources discoverable for proper death/despawn cleanup.
 model.userData.sandforgeHumanPants=mesh;
 model.userData.sandforgeTrouserStatus='skinned';
 return true;
}
export function disposeSkinnedTrousers(model){
 const mesh=model?.userData?.sandforgeHumanPants;
 if(!mesh)return false;
 mesh.skeleton?.dispose();
 mesh.geometry?.dispose();
 model.userData.sandforgeHumanPants=null;
 return true;
}
