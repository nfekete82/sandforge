import * as THREE from 'three';
import {FACTION_PAINT} from './sandforge-faction-palette.js';

/**
 * Real, flush wing-surface paint on the authored bomber GLB.
 *
 * The former onBeforeCompile injection could make the actual wing meshes
 * disappear when WebGL rejected their modified shaders. Never replace or
 * customize the original PBR materials, textures, normals or source geometry.
 * Instead clip the original upward-facing wing triangles to narrow bands and
 * paint them with a small, render-only surface mesh. No hovering flag planes.
 */
export const BOMBER_WING_STRIPES_REVISION='bomber-physical-surface-bands-v2-20261121';
const exclude=/cockpit|canopy|glass|window|rotor|propeller|engine|exhaust|gear|wheel|tire|tyre|weapon|gun|antenna|flag|emblem|shadow|landing|light|lamp|sensor|thruster/i;

function localBounds(model){
 model.updateWorldMatrix(true,true);
 const inverse=model.matrixWorld.clone().invert(),bounds=new THREE.Box3();
 model.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.geometry||mesh.userData?.teamMarking||
     mesh.userData?.sandforgeBomberWingSurfacePaint)return;
  if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
  bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(
   inverse.clone().multiply(mesh.matrixWorld)));
 });
 return bounds;
}

export function bomberWingStripeSpec(box){
 if(!box||box.isEmpty())return null;
 const size=box.getSize(new THREE.Vector3());
 if(!(size.x>0&&size.z>0&&size.y>0))return null;
 return Object.freeze({
  centerX:(box.min.x+box.max.x)*.5,
  centerZ:(box.min.z+box.max.z)*.5,
  halfSpan:size.x*.5,
  halfLength:size.z*.5,
  inside:.52,outside:.64,
  chordStart:-.50,chordEnd:.50,
  topNormal:.52
 });
}

// Sutherland–Hodgman clipping in the bomber's root/model coordinates.
// Works for both indexed and unindexed GLB wing meshes, including seams.
function clipPolygon(vertices,axis,limit,above){
 const result=[];
 for(let i=0;i<vertices.length;i++){
  const a=vertices[i],b=vertices[(i+1)%vertices.length];
  const ai=above?a[axis]>=limit:a[axis]<=limit;
  const bi=above?b[axis]>=limit:b[axis]<=limit;
  if(ai)result.push(a);
  if(ai!==bi){
   const t=(limit-a[axis])/(b[axis]-a[axis]);
   result.push(a.clone().lerp(b,t));
  }
 }
 return result;
}

export function disposeBomberWingStripes(model){
 const overlay=model?.getObjectByName('SandforgeBomberFlushWingPaint');
 if(!overlay||!overlay.userData?.sandforgeBomberWingSurfacePaint)return;
 overlay.removeFromParent();
 overlay.geometry.dispose();
 overlay.material.dispose();
 if(model?.userData){
  delete model.userData.sandforgeBomberWingPaintedMeshes;
  delete model.userData.sandforgeBomberWingPaintRevision;
  delete model.userData.sandforgeBomberWingPaintOwner;
 }
}

/** Returns the number of wing bands with real top-facing surface triangles. */
export function paintBomberWingStripes(model,owner){
 if(!model||(owner!==0&&owner!==1))return 0;
 const existing=model.getObjectByName('SandforgeBomberFlushWingPaint');
 if(existing&&model.userData.sandforgeBomberWingPaintOwner===owner)
  return model.userData.sandforgeBomberWingPaintedMeshes??0;
 disposeBomberWingStripes(model);
 const spec=bomberWingStripeSpec(localBounds(model));
 if(!spec)return 0;
 const inverse=model.matrixWorld.clone().invert();
 const lowerZ=spec.centerZ+spec.chordStart*spec.halfLength;
 const upperZ=spec.centerZ+spec.chordEnd*spec.halfLength;
 const sides=[-1,1].map(side=>({
  min:spec.centerX+Math.min(side*spec.inside,side*spec.outside)*spec.halfSpan,
  max:spec.centerX+Math.max(side*spec.inside,side*spec.outside)*spec.halfSpan,
  vertices:0
 }));
 const positions=[];
 model.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.geometry||mesh.isSkinnedMesh||
     mesh.userData?.teamMarking||mesh.userData?.sandforgeBomberWingSurfacePaint||
     exclude.test(mesh.name))return;
  const geometry=mesh.geometry,attribute=geometry.getAttribute('position');
  if(!attribute||attribute.itemSize<3)return;
  if(!geometry.boundingBox)geometry.computeBoundingBox();
  const toRoot=inverse.clone().multiply(mesh.matrixWorld);
  const meshBox=geometry.boundingBox.clone().applyMatrix4(toRoot);
  if(meshBox.max.z<lowerZ||meshBox.min.z>upperZ||
     !sides.some(side=>meshBox.min.x<side.max&&meshBox.max.x>side.min))return;
  const normals=geometry.getAttribute('normal');
  const normalMatrix=new THREE.Matrix3().getNormalMatrix(toRoot);
  const index=geometry.index;
  const triangleCount=Math.floor((index?.count??attribute.count)/3);
  const p=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];
  const n=new THREE.Vector3(),temp=new THREE.Vector3();
  for(let i=0;i<triangleCount;i++){
   const offsets=[0,1,2].map(k=>index?index.getX(i*3+k):i*3+k);
   for(let k=0;k<3;k++)
    p[k].fromBufferAttribute(attribute,offsets[k]).applyMatrix4(toRoot);
   if(normals){
    n.set(0,0,0);
    for(const offset of offsets){
     temp.fromBufferAttribute(normals,offset).applyMatrix3(normalMatrix).normalize();
     n.add(temp);
    }
    n.normalize();
   }else{
    n.subVectors(p[1],p[0]).cross(temp.subVectors(p[2],p[0])).normalize();
   }
   if(n.y<spec.topNormal)continue;
   if(Math.max(p[0].z,p[1].z,p[2].z)<lowerZ||
      Math.min(p[0].z,p[1].z,p[2].z)>upperZ)continue;
   const minX=Math.min(p[0].x,p[1].x,p[2].x);
   const maxX=Math.max(p[0].x,p[1].x,p[2].x);
   for(const side of sides){
    if(maxX<=side.min||minX>=side.max)continue;
    let polygon=p.map(v=>v.clone());
    for(const [axis,limit,above] of [
     ['x',side.min,true],['x',side.max,false],
     ['z',lowerZ,true],['z',upperZ,false]
    ]){
     if(polygon.length<3)break;
     polygon=clipPolygon(polygon,axis,limit,above);
    }
    if(polygon.length<3)continue;
    // A tiny root-space offset and polygon offset eliminate z-fighting,
    // while the decal follows every original wing triangle precisely.
    for(let k=1;k<polygon.length-1;k++)
     for(const v of [polygon[0],polygon[k],polygon[k+1]])
      positions.push(v.x,v.y+.075,v.z);
    side.vertices+=(polygon.length-2)*3;
   }
  }
 });
 const count=sides.filter(side=>side.vertices>0).length;
 if(!positions.length)return 0;
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.computeVertexNormals();
 geometry.computeBoundingSphere();
 const material=new THREE.MeshStandardMaterial({
  color:FACTION_PAINT[owner],roughness:.78,metalness:.08,
  side:THREE.DoubleSide,transparent:true,opacity:.94,depthWrite:false,
  polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2
 });
 const overlay=new THREE.Mesh(geometry,material);
 overlay.name='SandforgeBomberFlushWingPaint';
 overlay.userData={sandforgeBomberWingSurfacePaint:true,visualOnly:true,
  nonPlayable:true,teamMarking:true};
 overlay.castShadow=false;
 overlay.receiveShadow=false;
 overlay.raycast=()=>{};
 model.add(overlay);
 model.userData.sandforgeBomberWingPaintedMeshes=count;
 model.userData.sandforgeBomberWingPaintRevision=BOMBER_WING_STRIPES_REVISION;
 model.userData.sandforgeBomberWingPaintOwner=owner;
 return count;
}
