import * as THREE from 'three';

/** Shared deterministic micro-PBR textures: no untextured bright primitives. */
const maps=new Map();
function textureSet(key,rgb){
 if(maps.has(key))return maps.get(key);
 const n=64,mk=()=>new Uint8Array(n*n*4),base=mk(),normal=mk(),rough=mk();
 let x=key.length*239+1429;
 for(let i=0;i<n*n;i++){
  x=(Math.imul(x,1664525)+1013904223)>>>0;
  const grain=((x>>>24)/255-.5)*32,offset=i*4;
  for(let j=0;j<3;j++)base[offset+j]=Math.max(0,Math.min(255,rgb[j]+grain));
  base[offset+3]=255;
  normal[offset]=127+((x>>>13)&7)-3;normal[offset+1]=127+((x>>>19)&7)-3;normal[offset+2]=250;normal[offset+3]=255;
  rough[offset]=185+((x>>>7)&23);rough[offset+1]=rough[offset+2]=rough[offset];rough[offset+3]=255;
 }
 const create=(bytes,color=false)=>{
  const t=new THREE.DataTexture(bytes,n,n,THREE.RGBAFormat);
  if(color)t.colorSpace=THREE.SRGBColorSpace;
  t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.generateMipmaps=true;t.needsUpdate=true;return t;
 };
 const result={map:create(base,true),normalMap:create(normal),roughnessMap:create(rough)};
 maps.set(key,result);return result;
}
function metal(color,key='armor'){return new THREE.MeshStandardMaterial({
 ...textureSet(key,[141,140,124]),color,metalness:.38,roughness:.72
});}
const body=metal('#ded5be'),dark=metal('#646761','black-steel');
const crystal=new THREE.MeshStandardMaterial({
 ...textureSet('veyrit-crystal',[126,225,223]),color:'#5affea',
 emissive:'#13b9c7',emissiveIntensity:.35,metalness:.18,roughness:.22,
 transparent:false,side:THREE.DoubleSide
});
function add(group,geom,mat,x=0,y=0,z=0,rot=0){
 const m=new THREE.Mesh(geom,mat);
 m.position.set(x,y,z);m.rotation.y=rot;m.castShadow=true;m.receiveShadow=true;
 group.add(m);return m;
}
function seedRand(seed){let n=seed>>>0;return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}

/** Non-uniform irregular, faceted rock prism with independent peak offsets. */
function shardGeometry(){
 const sides=6,positions=[],uvs=[],indices=[],lower=[],upper=[];
 for(let i=0;i<sides;i++){
  const angle=i*Math.PI*2/sides;
  lower.push([Math.cos(angle)*(0.75+(i%3)*.18),0,Math.sin(angle)*(0.8+(i%2)*.24)]);
  upper.push([Math.cos(angle+.22)*(.3+(i%3)*.07),.62,Math.sin(angle+.22)*(.3+(i%2)*.08)]);
 }
 const tip=[.12,1.22,-.14];
 const push=(v,uv)=>{positions.push(...v);uvs.push(...uv);};
 for(let i=0;i<sides;i++){
  const j=(i+1)%sides,k=positions.length/3;
  push(lower[i],[i/sides,0]);push(lower[j],[j/sides,0]);
  push(upper[i],[i/sides,.63]);push(upper[j],[j/sides,.63]);
  push(tip,[(i+.5)/sides,1]);
  indices.push(k,k+1,k+2,k+1,k+3,k+2,k+2,k+3,k+4);
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 g.setIndex(indices);g.computeVertexNormals();return g;
}
const shard=shardGeometry();
export function createVeyritFieldVisuals(fields,scene,pos,heightAt){
 const views=new Map();
 for(const field of fields){
  const root=new THREE.Group();root.name='Veyrit-Feld-'+field.id;
  root.position.copy(pos(field.x,field.y,heightAt(field.x,field.y)+.3));
  const count=36,mesh=new THREE.InstancedMesh(shard,crystal,count);
  mesh.name='Veyrit_Sharp_Crystal_Clusters';mesh.castShadow=true;mesh.receiveShadow=true;
  const rng=seedRand(7189+field.id*3001),o=new THREE.Object3D();
  for(let i=0;i<count;i++){
   const angle=i*2.39996+rng()*.3,radius=9+Math.sqrt(rng())*83;
   o.position.set(Math.cos(angle)*radius,0,Math.sin(angle)*radius);
   o.rotation.set((rng()-.5)*.3,rng()*Math.PI*2,(rng()-.5)*.3);
   const h=12+rng()*31+(i%9===0?20:0);
   o.scale.set(h*(.42+rng()*.2),h,h*(.42+rng()*.2));o.updateMatrix();
   mesh.setMatrixAt(i,o.matrix);
  }
  mesh.instanceMatrix.needsUpdate=true;root.add(mesh);
  scene.add(root);views.set(field.id,{root,mesh});
 }
 return {
  sync(live){
   for(const f of live){
    const view=views.get(f.id);if(!view)continue;
    const ratio=Math.max(0,Math.min(1,f.amount/f.capacity));
    view.mesh.count=Math.max(3,Math.round(36*ratio));
    view.root.visible=f.amount>0;
   }
  },
  dispose(){
   for(const v of views.values())scene.remove(v.root);
   views.clear();
  }
 };
}

export function createVeyritHarvester(owner=0){
 const g=new THREE.Group();g.name='Veyrit_Harvester_PBR';
 const accent=metal(owner===0?'#4a8dab':'#a65a4b','faction-mark');
 add(g,new THREE.BoxGeometry(61,15,102),body,0,22,0);
 add(g,new THREE.BoxGeometry(51,9,62),dark,0,32,-12);
 add(g,new THREE.BoxGeometry(44,20,34),body,0,41,31);
 add(g,new THREE.BoxGeometry(25,14,20),accent,0,56,32);
 for(const side of [-1,1]){
  const x=side*37;
  add(g,new THREE.BoxGeometry(14,18,97),dark,x,12,-3);
  for(let z=-37;z<=37;z+=18){
   const wheel=add(g,new THREE.CylinderGeometry(7,7,16,10),dark,x,12,z);
   wheel.rotation.z=Math.PI/2;
  }
  add(g,new THREE.BoxGeometry(5,8,47),accent,side*31,30,1);
 }
 const jaws=[-1,1];
 for(const side of jaws){
  const arm=add(g,new THREE.BoxGeometry(8,9,50),dark,side*25,20,70);
  arm.rotation.x=-.16;
  const claw=add(g,new THREE.BoxGeometry(16,9,24),accent,side*28,14,96);
  claw.rotation.y=side*.27;
 }
 for(let i=0;i<5;i++){
  const facet=add(g,shard,crystal,(i-2)*9,43,-24+(i%2)*16,i*.6);
  facet.scale.set(6,12+(i%3)*6,7);
 }
 add(g,new THREE.BoxGeometry(49,5,8),dark,0,15,100);
 return g;
}

export function createVeyritRefinery(owner=0){
 const g=new THREE.Group();g.name='Veyrit_Refinery_PBR';
 const accent=metal(owner===0?'#50849a':'#95544b','refinery-team');
 const pipe=metal('#959991','refinery-pipes');
 add(g,new THREE.BoxGeometry(158,9,127),dark,0,5,0);
 add(g,new THREE.BoxGeometry(113,34,78),body,0,27,20);
 add(g,new THREE.BoxGeometry(111,9,79),dark,0,49,20);
 add(g,new THREE.BoxGeometry(64,13,67),accent,0,44,-31);
 for(const side of [-1,1]){
  const tank=add(g,new THREE.CylinderGeometry(19,22,69,12),body,side*56,43,-32);
  tank.name='Veyrit_Processing_Tank_'+side;
  add(g,new THREE.CylinderGeometry(21,21,7,12),dark,side*56,81,-32);
  add(g,new THREE.BoxGeometry(9,5,65),pipe,side*42,75,-30);
  add(g,new THREE.BoxGeometry(12,29,8),pipe,side*42,61,-62);
 }
 const conveyor=add(g,new THREE.BoxGeometry(40,13,61),dark,0,18,85);
 conveyor.rotation.x=-.16;
 for(let z=61;z<105;z+=12)add(g,new THREE.BoxGeometry(36,2,3),accent,0,27,z);
 for(let i=0;i<7;i++){
  const sliver=add(g,shard,crystal,(i-3)*10,20,71+(i%2)*8,i*1.6);
  sliver.scale.set(6,11+(i%4)*4,7);
 }
 add(g,new THREE.BoxGeometry(69,3,11),accent,0,62,9);
 return g;
}
