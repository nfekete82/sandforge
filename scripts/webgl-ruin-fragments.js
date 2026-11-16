import * as THREE from 'three';

/** Modern desert micro-ruins: two shattered walls and a sparse rubble pile,
 * never a downsized intact house. Geometry is VISUAL ONLY; the matching
 * collision footprint is set by generateCanyonFeatures in canyon-front.ts.
 * Legacy maps continue to load the original glTF houses unchanged.
 */
export const SMALL_RUIN_REVISION='micro-ruin-open-walls-v1-20261116';
export const isSmallRuin=ruin=>ruin.variant!==1&&ruin.height<30;
const randomFrom=seed=>{
 let x=seed>>>0;
 return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};
};
function brokenWall(length,height,thickness,rand){
 // A low, chipped outline with open sky above it: no roof, full corner or
 // surviving box-house silhouette. Facade and side faces remain actual 3D.
 const s=new THREE.Shape();
 const steps=7,drop=height*(.27+rand()*.17);
 s.moveTo(-length*.5,0);
 s.lineTo(length*.5,0);
 s.lineTo(length*.5,height*(.30+rand()*.15));
 for(let i=steps-1;i>=0;i--){
  const x=-length*.5+length*(i+1)/(steps+1);
  const crest=Math.max(.24,.82-Math.abs(i-steps*.48)*.10);
  s.lineTo(x,height*crest-drop*rand()*.40);
 }
 s.lineTo(-length*.5,height*(.36+rand()*.22));
 s.closePath();
 const g=new THREE.ExtrudeGeometry(s,{depth:thickness,steps:1,bevelEnabled:false,curveSegments:1});
 g.computeVertexNormals();
 return g;
}
export function makeSmallRuinFragments(ruin,seed=0,index=0,{
 texture=null,lowQuality=false
}={}){
 const rand=randomFrom((seed^Math.imul(index+1,0x9e3779b9)^0x71b6c55f)>>>0);
 const group=new THREE.Group();
 group.name='visual-small-ruin-fragments-'+index;
 group.userData={visualOnly:true,nonPlayable:true,smallRuin:true,
  roofless:true,revision:SMALL_RUIN_REVISION};
 const plaster=new THREE.MeshStandardMaterial({
  color:'#ac9574',map:texture,roughness:1,metalness:0,side:THREE.DoubleSide
 });
 const stone=new THREE.MeshStandardMaterial({color:'#8e7c65',map:texture,roughness:1,metalness:0});
 const main=2+(index%5===0?1:0);
 const footprint=Math.min(ruin.width,ruin.depth);
 let maximumHeight=0;
 for(let i=0;i<main;i++){
  const length=footprint*(i===0?.32:i===1?.22:.14)*(0.82+rand()*.22);
  const height=Math.min(18,ruin.height*(i===0?.64:i===1?.46:.30));
  const thickness=2.4+rand()*1.5;
  const mesh=new THREE.Mesh(brokenWall(length,height,thickness,rand),i===0?plaster:stone);
  mesh.name='BrokenWallFragment_'+i;
  mesh.userData={visualOnly:true,nonPlayable:true,ruinWall:true};
  const x=i===0?-ruin.width*.15:i===1?-ruin.width*.31:ruin.width*.18;
  const z=i===0?-ruin.depth*.12:i===1?ruin.depth*.08:ruin.depth*.22;
  mesh.position.set(x,.10,z);
  mesh.rotation.y=i===1?Math.PI*.51+(rand()-.5)*.23:(rand()-.5)*.30;
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.raycast=()=>{};
  group.add(mesh);maximumHeight=Math.max(maximumHeight,height+.1);
 }
 const rubbleCount=(lowQuality?2:3)+(index%3===0?1:0);
 const rubbleGeometry=new THREE.TetrahedronGeometry(1,0);
 const rubble=new THREE.InstancedMesh(rubbleGeometry,stone,rubbleCount);
 rubble.name='SparseRuinRubble';
 rubble.userData={visualOnly:true,nonPlayable:true,ruinRubble:true};
 rubble.castShadow=false;rubble.receiveShadow=true;rubble.raycast=()=>{};
 const object=new THREE.Object3D();
 for(let i=0;i<rubbleCount;i++){
  const w=1.7+rand()*2.0;
  const d=1.4+rand()*1.7;
  const y=.4+rand()*.8;
  object.position.set((rand()-.5)*ruin.width*.70,y,(rand()-.5)*ruin.depth*.70);
  object.rotation.set(rand()*.5,rand()*Math.PI*2,rand()*.5);
  object.scale.set(w,y*2.2,d);
  object.updateMatrix();rubble.setMatrixAt(i,object.matrix);
 }
 rubble.instanceMatrix.needsUpdate=true;group.add(rubble);
 group.userData.wallCount=main;
 group.userData.rubbleCount=rubbleCount;
 group.userData.maximumHeight=maximumHeight;
 return group;
}
