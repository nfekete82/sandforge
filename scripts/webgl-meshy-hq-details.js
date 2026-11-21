import * as THREE from 'three';
import {DecalGeometry} from 'three/addons/geometries/DecalGeometry.js';

/** Meshy HQ geometry-safe details.
 * The GLB has the original entrance and painted crest baked into textured
 * mesh triangles; fragment-shader cutouts once made the WHOLE HQ disappear.
 * Never edit the shared GLB, its atlas, its original shader or collider here.
 */
export const HQ_DETAILS_REVISION='sandforge-hq-snug-double-door-surface-crest-v2';
const visualFlag={sandforgeStyleDecoration:true,visualOnly:true,nonBlocking:true};

function makeDoorPaint(){
 const mat=new THREE.MeshStandardMaterial({
  color:'#74746a',metalness:.39,roughness:.81,side:THREE.DoubleSide
 });
 if(typeof document==='undefined')return mat;
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=256;
 const ctx=canvas.getContext('2d',{willReadFrequently:false});
 if(!ctx)return mat;
 // Industrial mesh/grille pattern, like the already textured original doors.
 ctx.fillStyle='#323935';ctx.fillRect(0,0,128,256);
 let seed=2031;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<1400;i++){
  const g=Math.floor(22+random()*40);
  ctx.fillStyle='rgba('+g+','+(g+2)+','+g+','+(.07+random()*.20)+')';
  ctx.fillRect(random()*128,random()*256,1+random()*7,1+random()*8);
 }
 for(let y=12;y<250;y+=13){
  ctx.fillStyle='#151b1b';ctx.fillRect(7,y,114,3);
  ctx.fillStyle='#424844';ctx.fillRect(7,y+3,114,1.5);
  for(let x=10;x<119;x+=17){
   ctx.strokeStyle='#343c37';ctx.lineWidth=1.4;
   ctx.strokeRect(x,y+4,12,7);
  }
 }
 ctx.strokeStyle='#62665c';ctx.lineWidth=5;
 ctx.strokeRect(3,3,122,250);
 const tex=new THREE.CanvasTexture(canvas);
 tex.colorSpace=THREE.SRGBColorSpace;
 tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping;
 mat.color.set('#ffffff');mat.map=tex;mat.needsUpdate=true;
 mat.userData.hqOwnedDoorTexture=true;
 return mat;
}
export function createHeadquartersHingedDoor(model,bounds){
 const site=model?.userData?.sandforgeRealHQDoorway;
 if(!site||bounds?.isEmpty())return null;
 const dims=bounds.getSize(new THREE.Vector3());
 const doorWidth=Math.min(dims.x*.116,dims.y*.246);
 const doorHeight=Math.min(dims.y*.178,doorWidth*1.40);
 if(!Number.isFinite(doorWidth)||doorWidth<=0||doorHeight<=0)return null;
 const faceOffset=Math.max(dims.z*.0023,.00035);
 const rig=new THREE.Group();
 rig.name='SF_HQ_RealEntrance_AnimatedLeaves';
 rig.userData={...visualFlag,hqRealEntrance:true};
 rig.position.set(site.x,bounds.min.y+dims.y*.039,site.z+faceOffset);
 const backing=new THREE.Mesh(
  new THREE.PlaneGeometry(doorWidth*.99,doorHeight*.99),
  new THREE.MeshStandardMaterial({color:'#141919',metalness:.10,roughness:.95,
   side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1})
 );
 backing.name='SF_HQ_Doorway_DarkInterior';
 backing.position.set(0,doorHeight*.5,0);
 backing.userData={...visualFlag};
 backing.raycast=()=>{};rig.add(backing);
 const paint=makeDoorPaint(),leafW=doorWidth*.49;
 const leafGeo=new THREE.BoxGeometry(leafW,doorHeight,Math.max(dims.z*.002,.0003));
 const panels=[];
 for(const [side,pivotX] of [['left',-doorWidth*.5],['right',doorWidth*.5]]){
  const hinge=new THREE.Group();hinge.name='SF_HQ_OriginalDoor_Hinge_'+side;
  hinge.position.set(pivotX,0,faceOffset*.12);
  hinge.userData={...visualFlag};
  const leaf=new THREE.Mesh(leafGeo,paint);
  leaf.name='SF_HQ_RealDoubleDoor_'+side;
  leaf.position.set(side==='left'?leafW*.5:-leafW*.5,doorHeight*.5,0);
  leaf.castShadow=false;leaf.receiveShadow=true;leaf.raycast=()=>{};
  leaf.userData={...visualFlag};
  hinge.add(leaf);rig.add(hinge);panels.push(hinge);
 }
 model.add(rig);
 const state={
  kind:'headquarters',mode:'hinged-real-entrance',open:0,uniforms:[],
  rig,backing,left:panels[0],right:panels[1],width:doorWidth,height:doorHeight,
  setOpen(amount){
   this.open=Math.max(0,Math.min(1,Number(amount)||0));
   this.left.rotation.y=-1.12*this.open;
   this.right.rotation.y=1.12*this.open;
  },
  dispose(){
   rig.removeFromParent();
   leafGeo.dispose();paint.map?.dispose();paint.dispose();
   backing.geometry.dispose();backing.material.dispose();
  }
 };
 return state;
}
function makeUnmarkedMetal(){
 const mat=new THREE.MeshStandardMaterial({
  color:'#414741',metalness:.38,roughness:.84,side:THREE.DoubleSide,
  polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-2
 });
 if(typeof document==='undefined')return mat;
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
 const ctx=canvas.getContext('2d');if(!ctx)return mat;
 ctx.fillStyle='#3f4540';ctx.fillRect(0,0,128,128);
 let seed=2511;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<5000;i++){
  const g=Math.floor(43+random()*36);
  ctx.fillStyle='rgba('+g+','+(g+2)+','+Math.floor(g*.89)+','+(.06+random()*.11)+')';
  ctx.fillRect(random()*128,random()*128,random()*4+.5,random()*3+.5);
 }
 ctx.strokeStyle='rgba(25,28,28,.28)';ctx.lineWidth=1;
 for(const x of [5,120]){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,128);ctx.stroke();}
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
 mat.color.set('#ffffff');mat.map=map;mat.userData.hqOwnedCrestTexture=true;
 return mat;
}
/** Conform a plain industrial-metal decal to the actual curved RIGHT annex.
 * A DecalGeometry is generated from real GLB triangles, so this cannot float
 * as a rectangle or hide the rest of the command center. It costs no shader
 * patch and does not affect radar, engineer door or world collision.
 */
export function coverHeadquartersAnnexCrest(model,bounds){
 if(!model||bounds.isEmpty())return null;
 const existing=model.getObjectByName('SF_HQ_Annex_UnmarkedMetal');
 if(existing)return existing;
 model.updateWorldMatrix(true,true);
 const size=bounds.getSize(new THREE.Vector3()),min=bounds.min;
 const worldToHQ=model.matrixWorld.clone().invert();
 const worldScale=model.getWorldScale(new THREE.Vector3());
 const worldRotation=model.getWorldQuaternion(new THREE.Quaternion());
 // The logo is on the arched RIGHT hangar flank, not on its main door.
 // Project from two perpendicular outside directions. Earlier we placed
 // one projector in the empty space of the whole-HQ bounding box, with no
 // surface offset; valid geometry counts still left the crest visible.
 const targets=[
  {name:'right-side',x:.83,y:.32,z:.59,axis:'x',sign:1,
   rotation:new THREE.Euler(0,Math.PI/2,0),
   size:new THREE.Vector3(size.x*.27,size.y*.32,size.z*.39)},
  {name:'front-curve',x:.77,y:.34,z:.70,axis:'z',sign:1,
   rotation:new THREE.Euler(0,0,0),
   size:new THREE.Vector3(size.x*.30,size.y*.28,size.z*.22)}
 ];
 const original=[];
 model.traverse(node=>{
  if(node.isMesh&&node.geometry&&!node.userData?.sandforgeStyleDecoration)
   original.push(node);
 });
 const group=new THREE.Group();group.name='SF_HQ_Annex_UnmarkedMetal';
 group.userData={...visualFlag,hqCrestCover:true,sourceRevision:HQ_DETAILS_REVISION};
 const mat=makeUnmarkedMetal();
 // A tiny normal offset removes z-fighting against both the GLB's painted
 // shield and any embossed 3D crest, without hiding surrounding panels.
 const surfaceLift=Math.max(.0002,Math.min(size.x,size.z)*.004);
 let triangles=0,successfulProjections=0;
 for(const target of targets){
  const candidate=new THREE.Vector3(
   min.x+size.x*target.x,min.y+size.y*target.y,min.z+size.z*target.z);
  const outside=candidate.clone();
  const direction=new THREE.Vector3();
  if(target.axis==='x'){
   outside.x=bounds.max.x+size.x*.22;direction.set(-1,0,0);
  }else{
   outside.z=bounds.max.z+size.z*.22;direction.set(0,0,-1);
  }
  const worldOrigin=model.localToWorld(outside);
  const worldDirection=direction.transformDirection(model.matrixWorld);
  const hits=new THREE.Raycaster(worldOrigin,worldDirection,0,
   Math.max(size.x*worldScale.x,size.z*worldScale.z)*2).intersectObjects(original,false);
  const good=hits.find(hit=>{
   const point=hit.point.clone().applyMatrix4(worldToHQ);
   // Reject the surrounding fence and the central tower; keep the right
   // annex roof and outer wall only.
   return point.x>min.x+size.x*.63&&point.x<=bounds.max.x+size.x*.005&&
    point.y>min.y+size.y*.12&&point.y<min.y+size.y*.58&&
    point.z>min.z+size.z*.31&&point.z<=bounds.max.z+size.z*.005;
  });
  const center=good?good.point.clone().applyMatrix4(worldToHQ):candidate;
  // Position the volume on the ACTUAL roof/wall surface, not at its
  // estimated bounding-box centre. This is why prior decals missed.
  const pos=model.localToWorld(center);
  const rotation=new THREE.Euler().setFromQuaternion(
   worldRotation.clone().multiply(new THREE.Quaternion().setFromEuler(target.rotation)));
  const worldSize=target.size.clone().multiply(worldScale);
  let passes=0;
  for(const mesh of original){
   if(triangles>18000)break;
   try{
    const geo=new DecalGeometry(mesh,pos,rotation,worldSize);
    const count=geo.getAttribute('position')?.count??0;
    if(count<3){geo.dispose();continue;}
    geo.applyMatrix4(worldToHQ);
    const vertices=geo.getAttribute('position');
    const normals=geo.getAttribute('normal');
    if(vertices&&normals){
     const point=new THREE.Vector3(),normal=new THREE.Vector3();
     for(let i=0;i<vertices.count;i++){
      point.fromBufferAttribute(vertices,i);
      normal.fromBufferAttribute(normals,i).normalize();
      point.addScaledVector(normal,surfaceLift);
      vertices.setXYZ(i,point.x,point.y,point.z);
     }
     vertices.needsUpdate=true;geo.computeBoundingSphere();
    }
    const patch=new THREE.Mesh(geo,mat);
    patch.name='SF_HQ_Annex_NeutralPanelTriangles';
    patch.castShadow=false;patch.receiveShadow=true;patch.raycast=()=>{};
    patch.renderOrder=11;
    patch.userData={...visualFlag,decalDirection:target.name};
    group.add(patch);triangles+=count/3;passes++;
   }catch(error){
    console.warn('HQ crest cover skipped unsupported surface',error);
   }
  }
  if(passes)successfulProjections++;
 }
 if(!group.children.length){mat.map?.dispose();mat.dispose();return null;}
 model.add(group);
 group.userData.coveredTriangles=triangles;
 group.userData.projectionSurfaces=successfulProjections;
 return group;
}
