import * as THREE from 'three';
import {renderGroundHeightSampler} from './webgl-environment.js';

/** Fixed-seed abandoned hamlets on the playable desert. These are purely
 * visual: no writes to World.blocked, collision, buildError or the save file.
 * One batched road and four bounded instanced meshes keep draw calls stable.
 */
export const DESERT_VILLAGE_ART_REVISION='abandoned-adobe-v1-20261115';
const mix=(a,b,t)=>a+(b-a)*t;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const seeded=seed=>{
 let state=(seed^0x73c9a515)>>>0;
 return ()=>{
  state=(Math.imul(state,1664525)+1013904223)>>>0;
  return state/4294967296;
 };
};
const sidePoint=(v,x,z)=>{
 const cos=Math.cos(v.angle),sin=Math.sin(v.angle);
 return {x:v.x+x*cos+z*sin,y:v.y-x*sin+z*cos};
};
const safe=(world,p)=>{
 const index=world.index(p);
 return index>=0&&!world.blocked[index]&&(!world.walkable||world.walkable(p));
};
/** Testable, bounded village placement: no critical spawn or bastion overlap. */
export function planDesertVillages({world,terrain,seed=world?.seed??0,lowQuality=false}){
 if(!world?.size||!world?.index||!terrain?.sites)return [];
 const random=seeded(seed),target=lowQuality?2:3,villages=[];
 const blocked=[...terrain.sites,...(terrain.ruins??[])];
 const margin=250;
 for(let attempt=0;attempt<480&&villages.length<target;attempt++){
  const x=margin+random()*(world.size-2*margin);
  const y=margin+random()*(world.size-2*margin);
  const angle=(Math.floor(random()*4)*Math.PI/2)+(random()-.5)*.24;
  const center={x,y,angle};
  if(!safe(world,center))continue;
  if(blocked.some(p=>dist(p,center)<290))continue;
  if(villages.some(p=>dist(p,center)<600))continue;
  const locations=[
   [0,-100],[0,0],[0,100],
   [-75,-95],[-75,0],[-75,95],
   [75,-95],[75,0],[75,95]
  ].map(([dx,dz])=>sidePoint(center,dx,dz));
  if(locations.some(p=>!safe(world,p)||
      blocked.some(s=>dist(s,p)<130)||
      (world.terrainSlope?.(p.x,p.y)??0)>.21))continue;
  const count=lowQuality?4:5+Math.floor(random()*3);
  const houses=[];
  const plots=[[-73,-100],[74,-92],[-69,-16],[71,3],[-76,87],[75,102],[-73,142]];
  for(let j=0;j<count;j++){
   const [cx,cz]=plots[j],w=26+random()*13,depth=25+random()*12;
   const location=sidePoint(center,cx+(random()-.5)*8,cz+(random()-.5)*8);
   houses.push({x:location.x,y:location.y,angle:angle+(random()-.5)*.22,
    width:w,depth,height:19+random()*13,damaged:random()>.37,
    tint:Math.floor(random()*3)});
  }
  villages.push({...center,houses,roadLength:300});
 }
 return villages;
}
function roadGeometry(villages,world,pos,heightAt){
 const actualHeight=renderGroundHeightSampler(heightAt,world.size);
 const positions=[],colors=[],indices=[];
 const lanes=[-1,-.78,-.58,-.43,-.18,.18,.43,.58,.78,1];
 const palette=['#d5c2a0','#c8b18d','#af9874','#c7b08d','#dcc49f',
  '#dcc49f','#c7b08d','#af9874','#c8b18d','#d5c2a0'].map(s=>new THREE.Color(s));
 for(const v of villages){
  const start=positions.length/3,steps=42;
  for(let j=0;j<=steps;j++){
   const t=j/steps,z=(t-.5)*v.roadLength;
   const centerX=Math.sin(t*Math.PI*1.65+v.angle)*7;
   // An old compacted road gradually fades back into open sand at both ends.
   const taper=.1+.9*Math.pow(Math.sin(Math.PI*t),.43);
   for(let k=0;k<lanes.length;k++){
    const worldPoint=sidePoint(v,centerX+lanes[k]*21*taper,z);
    const point=pos(worldPoint.x,worldPoint.y,actualHeight(worldPoint.x,worldPoint.y)+.36);
    positions.push(point.x,point.y,point.z);
    const shade=.97+.025*Math.sin(t*57+k*5+v.x*.003);
    const color=palette[k];
    colors.push(color.r*shade,color.g*shade,color.b*shade);
    if(j<steps&&k<lanes.length-1){
     const a=start+j*lanes.length+k,b=a+lanes.length;
     indices.push(a,a+1,b,a+1,b+1,b);
    }
   }
  }
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geo.setIndex(indices);
 geo.computeVertexNormals();geo.computeBoundingSphere();
 geo.userData={villageRoad:true,groundConforming:true};
 return geo;
}
function instanced(scene,name,material,max){
 const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),material,max);
 mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
 mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=true;
 mesh.raycast=()=>{};
 mesh.name=name;
 mesh.userData={visualOnly:true,nonPlayable:true,desertVillage:true,revision:DESERT_VILLAGE_ART_REVISION};
 scene.add(mesh);return mesh;
}
export function createDesertVillages({scene,world,terrain,pos,heightAt,seed=world?.seed??0,lowQuality=false}){
 const villages=planDesertVillages({world,terrain,seed,lowQuality});
 if(!villages.length)return {villages:[],meshes:[],roads:null,drawCalls:0};
 const walls=instanced(scene,'visual-abandoned-adobe-walls',
  new THREE.MeshStandardMaterial({color:'#d7bea0',roughness:.98,metalness:0}),250);
 const roofs=instanced(scene,'visual-abandoned-adobe-roof-fragments',
  new THREE.MeshStandardMaterial({color:'#ab9274',roughness:1,metalness:0}),60);
 const windows=instanced(scene,'visual-abandoned-adobe-window-recesses',
  new THREE.MeshStandardMaterial({color:'#675a4b',roughness:1,metalness:0}),80);
 const rubble=instanced(scene,'visual-abandoned-adobe-rubble',
  new THREE.MeshStandardMaterial({color:'#ad9477',roughness:1,metalness:0,flatShading:true}),130);
 const batches=[walls,roofs,windows,rubble],indices=[0,0,0,0];
 const dummy=new THREE.Object3D(),random=seeded(seed^0x517ab04e),half=world.size*.5;
 const palette=['#d6bb97','#c3ac90','#e2c9a8'].map(s=>new THREE.Color(s));
 const add=(batch,x,z,y,dx,dy,dz,angle,tint=0)=>{
  const mesh=batches[batch],n=indices[batch]++;
  if(n>=mesh.instanceMatrix.count){indices[batch]--;return;}
  dummy.position.set(x-half,y,z-half);
  dummy.rotation.set(0,angle,0);
  dummy.scale.set(dx,dy,dz);dummy.updateMatrix();
  mesh.setMatrixAt(n,dummy.matrix);
  if(batch===0)mesh.setColorAt(n,palette[tint%palette.length]);
 };
 for(const village of villages)for(const house of village.houses){
  const {x,z,y:locY}= {x:house.x,z:house.y,y:heightAt(house.x,house.y)};
  const w=house.width,depth=house.depth,h=house.height,a=house.angle;
  const relative=(lx,lz)=>{
   const c=Math.cos(a),s=Math.sin(a);
   return [x+lx*c+lz*s,z-lx*s+lz*c];
  };
  const section=(batch,lx,lz,ly,dx,dy,dz,tint=house.tint)=>{
   const [px,pz]=relative(lx,lz);
   add(batch,px,pz,locY+ly,dx,dy,dz,a,tint);
  };
  const wall=2.5,door=10,gap=(w-door)/2;
  // Intact back and side walls, but a real empty doorway on the road side.
  section(0,0,-depth/2,h/2,w,h,wall);
  section(0,-w/2+wall/2,0,h/2,wall,h,depth);
  section(0,w/2-wall/2,0,h/2,wall,h*(house.damaged?.64:1),depth);
  section(0,-w/2+gap/4,depth/2,h/2,gap/2,h,wall);
  section(0,w/2-gap/4,depth/2,h/2,gap/2,h,wall);
  section(0,0,depth/2,h-2.7,door+1,5.4,wall);
  // Partial collapsed roof gives readable, derelict silhouettes from above.
  section(1,-w*.22,-depth*.12,h+.45,w*.53,.95,depth*.80);
  if(!house.damaged)section(1,w*.24,-depth*.35,h+.45,w*.36,.95,depth*.24);
  // Dark recessed openings and irregular corners, never a solid toy block.
  section(2,-w/2-.09,-depth*.22,h*.60,.16,5.5,7);
  section(2,w/2+.09,depth*.12,h*.55,.16,6,8);
  section(2,0,-depth/2-.08,h*.63,6,7,.13);
  for(let k=0;k<(lowQuality?2:4);k++){
   const d=(random()*Math.PI*2),distance=17+random()*8;
   const [px,pz]=relative(Math.cos(d)*distance,Math.sin(d)*distance);
   const scale=1.2+random()*3.2;
   add(3,px,pz,heightAt(px,pz)+scale*.28,scale*1.8,scale*.56,scale*1.3,a+random()*.7);
  }
 }
 for(let i=0;i<batches.length;i++){
  batches[i].count=indices[i];
  batches[i].instanceMatrix.needsUpdate=true;
  if(batches[i].instanceColor)batches[i].instanceColor.needsUpdate=true;
 }
 const road=new THREE.Mesh(roadGeometry(villages,world,pos,heightAt),
  new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,
   transparent:true,opacity:.76,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,
   side:THREE.DoubleSide}));
 road.name='visual-abandoned-village-roads';
 road.userData={visualOnly:true,nonPlayable:true,desertVillage:true,
  groundConforming:true,revision:DESERT_VILLAGE_ART_REVISION};
 road.receiveShadow=true;road.raycast=()=>{};
 scene.add(road);
 return {villages,meshes:batches,roads:road,drawCalls:batches.length+1};
}
