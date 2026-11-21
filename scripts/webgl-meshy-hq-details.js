import * as THREE from 'three';
import {DecalGeometry} from 'three/addons/geometries/DecalGeometry.js';

/** Meshy HQ geometry-safe details.
 * The GLB has the original entrance and painted crest baked into textured
 * mesh triangles; fragment-shader cutouts once made the WHOLE HQ disappear.
 * Never edit the shared GLB, its atlas, its original shader or collider here.
 */
export const HQ_DETAILS_REVISION='sandforge-hq-physical-door-decal-v1';
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
 ctx.fillStyle='#252a29';ctx.fillRect(0,0,128,256);
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
 const doorWidth=Math.min(dims.x*.135,dims.y*.285);
 const doorHeight=Math.min(dims.y*.205,doorWidth*1.46);
 if(!Number.isFinite(doorWidth)||doorWidth<=0||doorHeight<=0)return null;
 const faceOffset=Math.max(dims.z*.006,.0008);
 const rig=new THREE.Group();
 rig.name='SF_HQ_RealEntrance_AnimatedLeaves';
 rig.userData={...visualFlag,hqRealEntrance:true};
 rig.position.set(site.x,bounds.min.y+dims.y*.035,site.z+faceOffset);
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
  hinge.position.set(pivotX,0,faceOffset*.7);
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
   this.left.rotation.y=-1.35*this.open;
   this.right.rotation.y=1.35*this.open;
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
  color:'#6f6d61',metalness:.38,roughness:.84,side:THREE.DoubleSide,
  polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-2
 });
 if(typeof document==='undefined')return mat;
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
 const ctx=canvas.getContext('2d');if(!ctx)return mat;
 ctx.fillStyle='#65685f';ctx.fillRect(0,0,128,128);
 let seed=2511;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<5000;i++){
  const g=Math.floor(70+random()*40);
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
 if(model.getObjectByName('SF_HQ_Annex_UnmarkedMetal'))return null;
 model.updateWorldMatrix(true,true);
 const size=bounds.getSize(new THREE.Vector3()),min=bounds.min;
 // The original insignia is on the right utility hangar's curved side.
 const position=new THREE.Vector3(min.x+size.x*.80,
  min.y+size.y*.30,min.z+size.z*.61);
 const decalSize=new THREE.Vector3(size.z*.29,size.y*.25,size.x*.33);
 const orientation=new THREE.Euler(0,Math.PI/2,0);
 const group=new THREE.Group();group.name='SF_HQ_Annex_UnmarkedMetal';
 group.userData={...visualFlag,hqCrestCover:true};
 const mat=makeUnmarkedMetal(),worldToHQ=model.matrixWorld.clone().invert();
 let faces=0;
 for(const mesh of model.children.slice()){
  // Iterate the genuine source mesh descendants, not the new door rig.
  mesh.traverse(node=>{
   if(!node.isMesh||node.userData?.sandforgeStyleDecoration||!node.geometry)return;
   if(faces>22000)return; // never flood the GPU with a duplicate whole building
   try{
    const geo=new DecalGeometry(node,position,orientation,decalSize);
    const n=geo.getAttribute('position')?.count??0;
    if(n<3){geo.dispose();return;}
    const patch=new THREE.Mesh(geo,mat);
    patch.name='SF_HQ_Annex_NeutralPanelTriangles';
    patch.geometry.applyMatrix4(worldToHQ);
    patch.castShadow=false;patch.receiveShadow=true;patch.raycast=()=>{};
    patch.userData={...visualFlag};
    group.add(patch);faces+=n/3;
   }catch(error){
    console.warn('HQ crest decal skipped for unsupported surface',error);
   }
  });
 }
 if(!group.children.length){mat.map?.dispose();mat.dispose();return null;}
 model.add(group);group.userData.coveredTriangles=faces;
 return group;
}
