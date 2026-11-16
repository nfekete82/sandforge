import * as THREE from 'three';
import {barracksPropMaterial} from './webgl-barracks-prop-materials.js';

// Render-only prop polish for the hand-authored Sandforge PBR barracks.
// Gameplay, collision, unit spawns, and the building hull remain unchanged.
const ORIGINAL_PARTS=/^(?:sandbag_|crate_|crate_top_reinforcement_|crate_front_reinforcement_|crate_mid_rib_|radar_)/;
const ORIGINAL_BAG=/^sandbag_/;
const ORIGINAL_CRATE=/^crate_(?:\d|top_reinforcement_|front_reinforcement_|mid_rib_)/;
const ORIGINAL_RADAR=/^radar_/;
function shadow(mesh){mesh.castShadow=true;mesh.receiveShadow=true;return mesh;}
function cylinderBetween(parent,name,from,to,radius,material,segments=9){
 const length=from.distanceTo(to),body=shadow(new THREE.Mesh(
  new THREE.CylinderGeometry(radius,radius,length,segments),material));
 body.name=name;
 body.position.copy(from).add(to).multiplyScalar(.5);
 body.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),to.clone().sub(from).normalize());
 parent.add(body);return body;
}

function addSandbags(root){
 const group=new THREE.Group();group.name='BarracksPolishedSandbags';
 const bagMat=barracksPropMaterial('linen');
 const darker=barracksPropMaterial('linenShade');
 const shape=new THREE.SphereGeometry(1,16,10),p=shape.attributes.position;
 for(let i=0;i<p.count;i++)p.setXYZ(i,p.getX(i)*.97,p.getY(i)*.77,p.getZ(i)*.95);
 shape.computeVertexNormals();
 for(const side of [-1,1])for(let tier=0;tier<2;tier++){
  const count=tier===0?3:2;
  for(let i=0;i<count;i++){
   const x=side*(1.88+i*.57+(tier?.27:0)),z=4.54+(tier?.07:0),y=tier?.55:.19;
   const sack=shadow(new THREE.Mesh(shape,tier===0||i===0?bagMat:darker));
   sack.name='BarracksLinenSandbag';sack.position.set(x,y,z);
   sack.scale.set(.45,.25,.32);sack.rotation.y=side*.065*(i%2?1:-1);
   group.add(sack);
  }
 }
 root.add(group);return group;
}
function addCrates(root){
 const group=new THREE.Group();group.name='BarracksPolishedCrates';
 const olive=barracksPropMaterial('olivePaint'),oliveLight=barracksPropMaterial('oliveLid');
 const wood=barracksPropMaterial('supplyWood'),steel=barracksPropMaterial('darkSteel');
 const placements=[
  {x:6.18,z:2.30,s:.84,wood:false},
  {x:6.18,z:1.23,s:.67,wood:true},
  {x:4.65,z:4.64,s:.80,wood:false},
  {x:-4.62,z:4.68,s:.84,wood:false}
 ];
 for(const [i,p] of placements.entries()){
  const box=new THREE.Group();box.name='BarracksSupplyCrate_'+i;box.position.set(p.x,0,p.z);
  const half=p.s*.5;
  const body=shadow(new THREE.Mesh(new THREE.BoxGeometry(p.s,p.s*.87,p.s),p.wood?wood:olive));
  body.position.y=p.s*.435;body.name='CrateArmouredBody';box.add(body);
  const lid=shadow(new THREE.Mesh(new THREE.BoxGeometry(p.s+.045,.065,p.s+.045),oliveLight));
  lid.position.y=p.s*.89;box.add(lid);
  for(const side of [-1,1]){
   const rib=shadow(new THREE.Mesh(new THREE.BoxGeometry(.055,p.s*.82,.075),steel));
   rib.position.set(side*(half-.08),p.s*.43,half+.008);box.add(rib);
   const top=shadow(new THREE.Mesh(new THREE.BoxGeometry(.065,.055,p.s+.05),steel));
   top.position.set(side*(half-.08),p.s*.91,0);box.add(top);
   const bolt=shadow(new THREE.Mesh(new THREE.BoxGeometry(.07,.07,.025),oliveLight));
   bolt.position.set(side*(half-.08),p.s*.75,half+.06);box.add(bolt);
  }
  const latch=shadow(new THREE.Mesh(new THREE.BoxGeometry(.18,.11,.035),steel));
  latch.position.set(0,p.s*.76,half+.037);box.add(latch);
  group.add(box);
 }
 root.add(group);return group;
}
function addRadar(root){
 const group=new THREE.Group();group.name='BarracksPolishedDish';
 const dark=barracksPropMaterial('darkSteel'),rim=barracksPropMaterial('brightSteel');
 const inside=barracksPropMaterial('dishMetal');
 const center=new THREE.Vector3(-3.85,5.52,-2.58);
 const facing=new THREE.Vector3(.72,.18,.67).normalize();
 const right=new THREE.Vector3(0,1,0).cross(facing).normalize();
 const up=facing.clone().cross(right).normalize();
 const n=32,rings=9,radius=.50,positions=[],uv=[],indices=[];
 for(let row=0;row<=rings;row++)for(let j=0;j<=n;j++){
  const r=radius*row/rings,a=2*Math.PI*j/n;
  const pt=center.clone().addScaledVector(right,r*Math.cos(a))
   .addScaledVector(up,r*Math.sin(a)).addScaledVector(facing,-.22*(1-(r/radius)**2));
  positions.push(pt.x,pt.y,pt.z);uv.push(j/n,row/rings);
 }
 for(let row=0;row<rings;row++)for(let j=0;j<n;j++){
  const a=row*(n+1)+j,b=a+n+1;indices.push(a,b,a+1,a+1,b,b+1);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.setIndex(indices);geometry.computeVertexNormals();
 const dishFace=inside.clone();dishFace.side=THREE.DoubleSide;
 const bowl=shadow(new THREE.Mesh(geometry,dishFace));bowl.name='ParabolicReflector';group.add(bowl);
 const edge=shadow(new THREE.Mesh(new THREE.TorusGeometry(radius,.018,8,40),rim));
 edge.position.copy(center);edge.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),facing);group.add(edge);
 cylinderBetween(group,'RadarMast',new THREE.Vector3(-3.6,4.50,-2.60),
  new THREE.Vector3(-3.6,5.65,-2.60),.055,dark);
 cylinderBetween(group,'DishSupport',new THREE.Vector3(-3.60,5.43,-2.60),center,.038,dark);
 cylinderBetween(group,'ReceiverArm',center.clone().addScaledVector(facing,-.18),
  center.clone().addScaledVector(facing,.47),.012,dark,7);
 const receiver=shadow(new THREE.Mesh(new THREE.SphereGeometry(.065,10,8),rim));
 receiver.position.copy(center).addScaledVector(facing,.49);group.add(receiver);
 const base=shadow(new THREE.Mesh(new THREE.CylinderGeometry(.24,.30,.14,12),dark));
 base.position.set(-3.60,4.52,-2.60);group.add(base);
 root.add(group);return group;
}

/** Only alter named, original GLB props; no-op for other barracks editions. */
export function polishBarracksProps(root){
 if(!root||root.getObjectByName('BarracksPolishedProps'))return false;
 const originals=[];
 root.traverse(node=>{if(node.isMesh&&ORIGINAL_PARTS.test(node.name))originals.push(node);});
 if(!originals.some(o=>ORIGINAL_BAG.test(o.name))||
    !originals.some(o=>ORIGINAL_CRATE.test(o.name))||
    !originals.some(o=>ORIGINAL_RADAR.test(o.name)))return false;
 originals.forEach(o=>{o.visible=false;});
 const result=new THREE.Group();result.name='BarracksPolishedProps';
 addSandbags(result);addCrates(result);addRadar(result);
 result.traverse(obj=>{if(obj.isMesh){
  obj.userData.sandforgeBarracksPropPolish=true;
  obj.raycast=()=>{};
 }});
 root.add(result);
 root.userData.sandforgeOriginalPBR=true;
 return true;
}
