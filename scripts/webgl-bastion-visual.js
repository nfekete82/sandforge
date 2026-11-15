/**
 * November 11 authored Bastion: remove only the bolt-on rectangular shield
 * on the south/front (+Z) edge of its circular foot. Keep the original
 * 3D radar, capture ring, side armor, camo, team lights and animations.
 *
 * The source GLB groups several disconnected steel pieces under one material,
 * so the long front rail must be removed by triangle position instead of
 * hiding its entire mesh (that would erase useful rear/side details).
 *
 * Run ONCE against the GLTFLoader-cached template, BEFORE SkeletonUtils.clone.
 * The original .glb on disk remains untouched and can be restored trivially.
 */
const SHIELD_COMPONENTS=Object.freeze([
 'AtlasUpgrade_bastion_camo',
 'AtlasUpgrade_bastion_hazard',
 'AtlasUpgrade_bastion_identity_badge'
]);
const FRONT_RAIL='AtlasUpgrade_bastion_steel';
const CUT_Z=.545;
const CUT_MAX_Y=.75;

export function removeBastionFrontShield(root){
 if(!root)return {removedNodes:0,removedTriangles:0,remainingTriangles:0};
 if(root.userData?.sandforgeFrontShieldRemoved)
  return {...root.userData.sandforgeFrontShieldRemoved};

 let removedNodes=0,removedTriangles=0,remainingTriangles=0;
 for(const name of SHIELD_COMPONENTS){
  const obj=root.getObjectByName(name);
  if(!obj)continue;
  if(obj.isMesh){
   const geometry=obj.geometry;
   removedTriangles+=(geometry.index?.count??geometry.attributes.position.count)/3;
  }
  obj.removeFromParent();
  removedNodes++;
 }
 const rail=root.getObjectByName(FRONT_RAIL);
 if(rail?.isMesh&&rail.geometry?.attributes?.position){
  const source=rail.geometry;
  const position=source.attributes.position;
  const index=source.getIndex();
  const count=index?index.count:position.count;
  const keep=[];
  for(let i=0;i+2<count;i+=3){
   const a=index?index.getX(i):i;
   const b=index?index.getX(i+1):i+1;
   const c=index?index.getX(i+2):i+2;
   // The rectangular blast barrier lives at front +Z, between 0.15 and
   // 0.67 high in original authored GLB coordinates. All other ring/side
   // steel remains. Test all vertices to avoid sliced triangles.
   const front=Math.min(position.getZ(a),position.getZ(b),position.getZ(c))>=CUT_Z;
   const low=Math.max(position.getY(a),position.getY(b),position.getY(c))<=CUT_MAX_Y;
   if(front&&low){removedTriangles++;continue;}
   keep.push(a,b,c);
  }
  if(keep.length<count){
   const geometry=source.clone();
   geometry.setIndex(keep);
   geometry.clearGroups();
   geometry.computeBoundingBox();
   geometry.computeBoundingSphere();
   geometry.userData={...geometry.userData,sandforgeBastionFrontTrimmed:true};
   rail.geometry=geometry;
  }
  remainingTriangles=keep.length/3;
 }
 const report={removedNodes,removedTriangles,remainingTriangles};
 root.userData.sandforgeFrontShieldRemoved=report;
 return {...report};
}
