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
export const SKINNED_TROUSERS_REVISION='human-articulated-cargo-pants-v1-20261121';
const TWO_PI=Math.PI*2;
const radial=14,segments=26;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const lerp=(a,b,t)=>a+(b-a)*t;
const profile=[
 [0.00,.136,.149],[.08,.141,.154],[.20,.133,.147],
 [.34,.121,.132],[.47,.109,.120],[.55,.116,.124],
 [.64,.119,.124],[.73,.116,.116],[.83,.105,.111],
 [.93,.094,.099],[1.00,.091,.097]
];
function measure(ratio,axis){
 for(let i=1;i<profile.length;i++){
  const prev=profile[i-1],next=profile[i];
  if(ratio<=next[0])return lerp(prev[axis],next[axis],
   smooth(prev[0],next[0],ratio));
 }
 return profile[profile.length-1][axis];
}
function findRig(model){
 const bones=new Map();
 model.traverse(node=>{if(node.isBone)bones.set(node.name,node);});
 const names=['UpperLegL','LowerLegL','FootL',
  'UpperLegR','LowerLegR','FootR'];
 const list=names.map(name=>bones.get(name));
 return list.every(Boolean)?list:null;
}
function addLeg(sideIndex,hip,knee,ankle,inverse,positions,uv,weights,indices,joints){
 const start=hip.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse);
 const middle=knee.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse);
 const finish=ankle.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse);
 // Stop the cloth INSIDE the top of the boot so there is no leg/boot gap.
 finish.y+=.075;
 const upperDistance=start.distanceTo(middle);
 const lowerDistance=middle.distanceTo(finish);
 if(upperDistance<.12||lowerDistance<.12)return false;
 const kneeT=upperDistance/(upperDistance+lowerDistance);
 const total=upperDistance+lowerDistance;
 // Foot-to-hip length scales trouser girth without changing the skeleton.
 const girth=clamp(total/1.02,.88,1.12);
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
  const upperWeight=1-smooth(kneeT-.13,kneeT+.035,t);
  const footWeight=smooth(.87,1.00,t)*(1-upperWeight);
  const lowerWeight=(1-upperWeight)-footWeight;
  for(let col=0;col<radial;col++){
   const a=TWO_PI*col/radial;
   // Folds are intentional *surface* deformation, not rigid armour bands.
   const fold=1+.028*Math.sin(a*5+t*27)+.017*Math.sin(a*8-t*39);
   const creasing=1+.010*Math.sin(t*58+a*3);
   const p=center.clone().addScaledVector(xAxis,Math.cos(a)*rX*fold)
     .addScaledVector(zAxis,Math.sin(a)*rZ*creasing);
   // A small forward knee break avoids a perfectly cylindrical "stilt".
   if(Math.abs(t-kneeT)<.08)
    p.addScaledVector(zAxis,.012*(1-Math.abs(t-kneeT)/.08));
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
 const bones=findRig(model);
 if(!bones)return false; // legacy GLB keeps the safe rigid fallback
 model.updateMatrixWorld(true);
 const inv=model.matrixWorld.clone().invert();
 const positions=[],uv=[],skinWeight=[],skinIndex=[],triangles=[];
 for(let side=0;side<2;side++)
  if(!addLeg(side,...bones.slice(side*3,side*3+3),inv,
    positions,uv,skinWeight,triangles,skinIndex))return false;
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
