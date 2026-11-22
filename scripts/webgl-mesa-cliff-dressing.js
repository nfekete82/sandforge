import * as THREE from 'three';
import {stoneMaterial,weatheredStoneGeometry} from './webgl-rock-materials.js';

/** Render-only sandstone talus and desiccated, finely branched cliff scrub.
 * The authoritative heightfield, ramps, obstacle lists, fog and saves are
 * never written to or extended. Two instanced meshes for the entire map.
 */
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=t=>{const v=clamp(t);return v*v*(3-2*v);};
const seededRandom=seed=>{
 let s=(seed^0x61e4d7b9)>>>0;
 return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const lineDistance=(p,a,b)=>{
 const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy||1;
 const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/den);
 return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);
};
const radiusFactor=(a,m)=>{
 const phase=m.seed*.00047+m.siteIndex*1.7;
 return 1+.045*Math.sin(a*5+phase)+.025*Math.cos(a*9-phase*.8);
};
/** Exactly the same ramp cone as raised-mesas.ts; don't decorate entrances. */
export function cliffDressingRampCoverage(p,m){
 const dx=p.x-m.center.x,dy=p.y-m.center.y;
 let coverage=0;
 for(const d of m.ramps?.length?m.ramps:[m.direction]){
  const along=dx*d.x+dy*d.y,lateral=Math.abs(dx*d.y-dy*d.x);
  if(along<m.topRadius-80||along>m.rampEnd+80)continue;
  coverage=Math.max(coverage,1-smooth((lateral-m.rampWidth*.56)/(m.rampWidth*.36)));
 }
 return coverage;
}
export function planMesaCliffDressing({
 world,terrain=world?.generated,seed=world?.seed??0,lowQuality=false
}={}){
 if(!world||world.mapVersion<23||!terrain?.plateaus?.length)return {stones:[],shrubs:[]};
 const random=seededRandom(seed),stones=[],shrubs=[];
 const size=world.size,sites=terrain.sites??[],ruins=terrain.ruins??[],
  roads=terrain.roads??[];
 const protectedPoint=(p,forPlant=false)=>{
  if(p.x<175||p.y<175||p.x>size-175||p.y>size-175)return true;
  if(sites.some(q=>distance(p,q)<(forPlant?390:280)))return true;
  if(ruins.some(q=>distance(p,q)<Math.max(q.width??0,q.depth??0)*.65+115))return true;
  if(roads.some(road=>road.slice(1).some((q,i)=>
   lineDistance(p,road[i],q)<(forPlant?146:105))))return true;
  return false;
 };
 for(const mesa of terrain.plateaus){
  if(!mesa?.center||!Number.isFinite(mesa.footRadius)||mesa.footRadius<=0)continue;
  const count=clamp(Math.round(2*Math.PI*mesa.footRadius/(lowQuality?120:76)),18,116);
  for(let i=0;i<count;i++){
   const angle=2*Math.PI*(i+.16+random()*.68)/count;
   const c=Math.cos(angle),s=Math.sin(angle),factor=radiusFactor(angle,mesa);
   // Short, fragmented talus aprons follow the real cliff toe; never a
   // continuous ring, repetitive boulder row or raised false terrain.
   const radial=mesa.footRadius+(random()-.38)*65;
   const center={x:mesa.center.x+c*radial*factor,
    y:mesa.center.y+s*radial*factor};
   if(protectedPoint(center)||cliffDressingRampCoverage(center,mesa)>.18)continue;
   if(!Number.isFinite(world.terrainSlope(center.x,center.y)))continue;
   if(random()<.18)continue; // preserve broad empty sand between patches
   const fragments=lowQuality?1+Math.floor(random()*2):2+Math.floor(random()*3);
   for(let n=0;n<fragments;n++){
    const a=angle+(random()-.5)*1.0,spread=8+random()*29;
    const p={x:center.x+Math.cos(a)*spread,y:center.y+Math.sin(a)*spread};
    if(protectedPoint(p)||cliffDressingRampCoverage(p,mesa)>.18)continue;
    const width=3.1+random()*7.3;
    stones.push({x:p.x,y:p.y,width,
     aspect:.60+random()*1.15,flat:.20+random()*.34,
     angle:random()*Math.PI*2,tint:random()});
   }
   // Small dry fern stands at the rock foot, with occasional scrub on a
   // broad, truly walkable summit. No artificial green spheres or cones.
   if(random()<.34){
    const crest=random()<.27;
    const r=crest?mesa.topRadius-85-random()*35:mesa.footRadius+63+random()*55;
    const p={x:mesa.center.x+c*r*factor,y:mesa.center.y+s*r*factor};
    if(!protectedPoint(p,true)&&cliffDressingRampCoverage(p,mesa)<.12&&
       world.walkable(p,[],14)&&world.terrainSlope(p.x,p.y)<.13){
      shrubs.push({x:p.x,y:p.y,angle:random()*Math.PI*2,
       scale:.62+random()*.70,tint:random()});
    }
   }
  }
 }
 return {
  stones:stones.slice(0,lowQuality?150:340),
  shrubs:shrubs.slice(0,lowQuality?36:100)
 };
}

const mapsCache=new Map();
function dryShrubPbrMaps(lowQuality){
 const key=lowQuality?'lite':'standard';
 if(mapsCache.has(key))return mapsCache.get(key);
 const size=lowQuality?64:128;
 const color=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4),
  rough=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const q=(y*size+x)*4;
  const a=Math.sin(x*.39+y*.13)*Math.cos(y*.33-x*.18);
  const b=Math.sin(x*.95-y*.72)*Math.cos(x*.44+y*.87);
  const fiber=.5+.5*Math.sin(x*.65+y*.23+2.7*a);
  const shade=clamp(.87+.13*a+.10*b-.08*fiber,.59,1.08);
  color[q]=Math.round(clamp(199*shade,0,255));
  color[q+1]=Math.round(clamp(190*shade,0,255));
  color[q+2]=Math.round(clamp(153*shade,0,255));
  color[q+3]=255;
  const nx=.5+.11*Math.sin(x*.55+y*.13),ny=.5+.09*Math.cos(y*.60-x*.17);
  normal[q]=Math.round(nx*255);normal[q+1]=Math.round(ny*255);
  normal[q+2]=251;normal[q+3]=255;
  rough[q]=rough[q+1]=rough[q+2]=Math.round(225+16*(1-fiber));
  rough[q+3]=255;
 }
 const texture=(bytes,srgb=false)=>{
  const t=new THREE.DataTexture(bytes,size,size,THREE.RGBAFormat);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;
  t.magFilter=THREE.LinearFilter;
  t.anisotropy=4;if(srgb)t.colorSpace=THREE.SRGBColorSpace;
  t.needsUpdate=true;return t;
 };
 const maps=Object.freeze({map:texture(color,true),
  normalMap:texture(normal),roughnessMap:texture(rough)});
 mapsCache.set(key,maps);return maps;
}
/** Curved branching stems and individual thin leaflets, a UV-mapped real
 * triangle mesh. Never an ellipsoid, intersecting cartoon cone or billboard.
 */
export function dryCliffScrubGeometry(lowQuality=false){
 const positions=[],uv=[],colors=[];
 const push=(p,t,c)=>{
  positions.push(...p);uv.push(...t);colors.push(...c);
 };
 const tri=(a,b,c,uvs,tone)=>{
  push(a,uvs[0],tone);push(b,uvs[1],tone);push(c,uvs[2],tone);
 };
 const branches=lowQuality?7:11;
 for(let k=0;k<branches;k++){
  const a=2*Math.PI*k/branches+.12*Math.sin(k*2.4);
  const dx=Math.cos(a),dz=Math.sin(a),height=8.5+3.4*Math.sin(k*2.1+1)**2;
  const reach=9+3.8*Math.cos(k*1.7)**2;
  const pos=t=>[dx*reach*t*t,height*(.93*t+.12*Math.sin(Math.PI*t)),
   dz*reach*t*t];
  const side=[-dz,0,dx],stem=[.61,.57,.43];
  for(let s=0;s<4;s++){
   const t=s/4,u=(s+1)/4,p=pos(t),q=pos(u);
   const w=.52*(1-t)+.10,h=.52*(1-u)+.10;
   const l=[p[0]+side[0]*w,p[1],p[2]+side[2]*w];
   const r=[p[0]-side[0]*w,p[1],p[2]-side[2]*w];
   const ll=[q[0]+side[0]*h,q[1],q[2]+side[2]*h];
   const rr=[q[0]-side[0]*h,q[1],q[2]-side[2]*h];
   tri(l,r,ll,[[0,t],[1,t],[0,u]],stem);
   tri(r,rr,ll,[[1,t],[1,u],[0,u]],stem);
  }
  const leaves=lowQuality?3:5;
  for(let j=0;j<leaves;j++){
   const t=.30+j*.12,p=pos(t),reachOut=4.1+2.7*Math.sin(j+k*.7)**2;
   for(const direction of [-1,1]){
    const tip=[p[0]+side[0]*direction*reachOut+dx*1.9,
     p[1]+(j%2?1.8:-.85),
     p[2]+side[2]*direction*reachOut+dz*1.9];
    const middle=[(p[0]+tip[0])*.5,(p[1]+tip[1])*.5+.45,
     (p[2]+tip[2])*.5];
    const w=1.8+(j%2)*.75;
    const left=[middle[0]-dx*w,middle[1]+.25,middle[2]-dz*w];
    const right=[middle[0]+dx*w,middle[1]-.25,middle[2]+dz*w];
    const tone=j%3===0?[.64,.62,.43]:j%3===1?[.80,.76,.58]:[.71,.69,.50];
    tri(p,left,tip,[[0,0],[0,1],[1,1]],tone);
    tri(p,tip,right,[[0,0],[1,1],[1,0]],tone);
   }
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geometry.computeVertexNormals();geometry.computeBoundingSphere();
 geometry.userData={dryCliffScrub:true,uvMapped:true,branchCount:branches};
 return geometry;
}
export function createMesaCliffDressing({
 scene,world,terrain=world?.generated,seed=world?.seed??0,
 heightAt,lowQuality=false
}={}){
 const plan=planMesaCliffDressing({world,terrain,seed,lowQuality});
 const root=new THREE.Group();root.name='Sandforge-Visual-Mesa-Talus-And-Dry-Scrub';
 root.userData={visualOnly:true,nonPlayable:true,nonBlocking:true,
  cliffDressing:true,collisionChanged:false};
 const meshes=[],half=(world?.size??0)*.5,dummy=new THREE.Object3D();
 const add=(mesh,points,configure)=>{
  for(const [i,p] of points.entries()){
   dummy.position.set(p.x-half,heightAt(p.x,p.y),p.y-half);
   dummy.rotation.set(0,p.angle,0);
   configure(dummy,p);
   dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
   const tint=new THREE.Color();
   tint.setHSL(.095+.027*p.tint,.13+.10*p.tint,.82-.20*p.tint);
   mesh.setColorAt(i,tint);
  }
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  mesh.computeBoundingSphere();
  mesh.raycast=()=>{};mesh.castShadow=false;mesh.receiveShadow=true;
  mesh.userData={visualOnly:true,nonPlayable:true,nonBlocking:true,
   cliffDressing:true,uvPbr:true};
  root.add(mesh);meshes.push(mesh);
 };
 if(plan.stones.length){
  const stones=new THREE.InstancedMesh(weatheredStoneGeometry(lowQuality),
   stoneMaterial('#d4b692',{lowQuality,flatShading:true}),plan.stones.length);
  stones.name='visual-mesa-weathered-scree';
  add(stones,plan.stones,(d,p)=>{
   d.position.y+=p.width*.12;
   d.rotation.x=(p.tint-.5)*.14;
   d.scale.set(p.width*p.aspect,p.width*p.flat,p.width*(.72+p.tint*.39));
  });
 }
 if(plan.shrubs.length){
  const pbr=dryShrubPbrMaps(lowQuality);
  const material=new THREE.MeshStandardMaterial({
   color:'#ffffff',map:pbr.map,normalMap:pbr.normalMap,
   roughnessMap:pbr.roughnessMap,vertexColors:true,
   side:THREE.DoubleSide,roughness:.98,metalness:0,
   normalScale:new THREE.Vector2(.40,.40)
  });
  const bush=new THREE.InstancedMesh(dryCliffScrubGeometry(lowQuality),
   material,plan.shrubs.length);
  bush.name='visual-mesa-withered-fronds';
  add(bush,plan.shrubs,(d,p)=>{
   d.position.y-=1.25*p.scale;
   d.scale.setScalar(p.scale);
  });
 }
 scene?.add(root);
 let disposed=false;
 return {root,plan,meshes,drawCalls:meshes.length,
  dispose(){if(disposed)return;disposed=true;root.removeFromParent();
   for(const mesh of meshes){mesh.geometry.dispose();mesh.material.dispose();mesh.dispose();}
   root.clear();
  }};
}
