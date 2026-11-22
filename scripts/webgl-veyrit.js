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
 ...textureSet('veyrit-crystal',[171,235,237]),color:'#c6fff9',
 emissive:'#0b8599',emissiveIntensity:.47,metalness:.06,roughness:.19,
 side:THREE.DoubleSide
});
function add(group,geom,mat,x=0,y=0,z=0,rot=0){
 const m=new THREE.Mesh(geom,mat);
 m.position.set(x,y,z);m.rotation.y=rot;m.castShadow=true;m.receiveShadow=true;
 group.add(m);return m;
}
function seedRand(seed){let n=seed>>>0;return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}

/** Faceted leaf-shaped shards grow in compact rosettes, not huge pyramids. */
function shardGeometry(){
 const sides=5,positions=[],uvs=[],indices=[];
 const bottom=[],middle=[];
 for(let k=0;k<sides;k++){
  const t=k*Math.PI*2/sides,skew=Math.sin(t*3)*.12;
  bottom.push([Math.cos(t)*(.74+skew),0,Math.sin(t)*(.74+skew)]);
  middle.push([Math.cos(t+.11)*.46,.44,Math.sin(t+.11)*.4]);
 }
 for(let k=0;k<sides;k++){
  const j=(k+1)%sides,offset=positions.length/3;
  for(const [p,uv] of [[bottom[k],[0,0]],[bottom[j],[1,0]],
    [middle[k],[0,.43]],[middle[j],[1,.43]],[[.09,1.36,-.08],[.5,1]]]){
   positions.push(...p);uvs.push(...uv);
  }
  indices.push(offset,offset+1,offset+2,offset+1,offset+3,offset+2,
   offset+2,offset+3,offset+4);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 geometry.setIndex(indices);geometry.computeVertexNormals();
 return geometry;
}
const shard=shardGeometry();

/** Canvas-generated ground atlas: cyan mineral veins and subtle dark mineral
 * crust. One shared small texture, no emissive point lights per crystal. */
function createMineralGroundTexture(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
 const ctx=canvas.getContext('2d'),size=512,rand=seedRand(47899);
 const image=ctx.createImageData(size,size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const dx=(x-256)/236,dy=(y-256)/236;
  const theta=Math.atan2(dy,dx),r=Math.hypot(dx,dy);
  const shape=.92+.085*Math.sin(5*theta)+.065*Math.sin(11*theta+1.5)+
    .038*Math.sin(19*theta+4);
  const fade=Math.max(0,Math.min(1,(shape-r)*8));
  const noise=rand(),i=(y*size+x)*4;
  image.data[i]=18+Math.floor(noise*12);
  image.data[i+1]=71+Math.floor(noise*18);
  image.data[i+2]=80+Math.floor(noise*16);
  image.data[i+3]=Math.round(fade*(31+noise*32));
 }
 ctx.putImageData(image,0,0);
 ctx.lineCap='round';
 for(let k=0;k<310;k++){
  const a=rand()*Math.PI*2,r=Math.sqrt(rand())*216;
  let x=256+Math.cos(a)*r,y=256+Math.sin(a)*r;
  const theta=a+(rand()-.5)*1.9,len=5+rand()*24;
  ctx.beginPath();ctx.moveTo(x,y);
  for(let j=1;j<=3;j++){
   x+=Math.cos(theta+(rand()-.5)*.7)*len/3;
   y+=Math.sin(theta+(rand()-.5)*.7)*len/3;
   ctx.lineTo(x,y);
  }
  ctx.strokeStyle='rgba(82,239,233,'+(.12+rand()*.36)+')';
  ctx.lineWidth=.6+rand()*.9;ctx.stroke();
 }
 for(let k=0;k<68;k++){
  const a=rand()*Math.PI*2,r=Math.sqrt(rand())*219;
  const x=256+Math.cos(a)*r,y=256+Math.sin(a)*r;
  const glow=ctx.createRadialGradient(x,y,1,x,y,3+rand()*8);
  glow.addColorStop(0,'rgba(69,241,229,.23)');
  glow.addColorStop(1,'rgba(42,200,200,0)');
  ctx.fillStyle=glow;ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.fill();
 }
 const map=new THREE.CanvasTexture(canvas);
 map.colorSpace=THREE.SRGBColorSpace;
 map.wrapS=map.wrapT=THREE.ClampToEdgeWrapping;
 map.magFilter=THREE.LinearFilter;
 map.minFilter=THREE.LinearMipmapLinearFilter;
 map.generateMipmaps=true;map.needsUpdate=true;
 return map;
}
let mineralTexture;
function drapedMineralGround(field,heightAt,centreHeight,radius){
 const divisions=19,geometry=new THREE.PlaneGeometry(radius*2,radius*2,divisions,divisions);
 geometry.rotateX(-Math.PI/2);
 const p=geometry.attributes.position;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),z=p.getZ(i);
  p.setY(i,heightAt(field.x+x,field.y+z)-centreHeight+.9);
 }
 p.needsUpdate=true;geometry.computeVertexNormals();
 mineralTexture??=createMineralGroundTexture();
 const material=new THREE.MeshBasicMaterial({
  map:mineralTexture,transparent:true,opacity:.82,
  side:THREE.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1
 });
 const mesh=new THREE.Mesh(geometry,material);
 mesh.name='Veyrit_Turquoise_Mineral_Ground';
 mesh.renderOrder=2;mesh.frustumCulled=false;
 return mesh;
}

/** Draws full, broad Tiberium-style mineral beds with small turquoise
 * crystal rosettes. One instanced draw call + one draped ground mesh/field. */
export function createVeyritFieldVisuals(fields,scene,pos,heightAt){
 const views=new Map(),tints=[
  new THREE.Color('#72f2e7'),new THREE.Color('#5ce2e5'),
  new THREE.Color('#8cfbef'),new THREE.Color('#2eb3cc')
 ];
 for(const field of fields){
  const root=new THREE.Group();root.name='Veyrit-Feld-'+field.id;
  const centreHeight=heightAt(field.x,field.y);
  root.position.copy(pos(field.x,field.y,centreHeight));
  const radius=field.radius??205;
  const count=792,mesh=new THREE.InstancedMesh(shard,crystal,count);
  mesh.name='Veyrit_Small_Turquoise_Crystal_Rosettes';
  mesh.castShadow=false;mesh.receiveShadow=true;mesh.frustumCulled=false;
  const rng=seedRand(7189+field.id*3001),o=new THREE.Object3D();
  const usable=radius*.91;
  for(let i=0;i<count;i++){
   // Four tiny shafts form one irregular rosette; many rosettes fill the field.
   const cluster=Math.floor(i/4),member=i%4;
   const angle=cluster*2.399963+(.5-rng())*.45;
   const r=Math.sqrt((cluster+.5)/Math.ceil(count/4))*usable*(.84+rng()*.28);
   const offset=member===0?0:2.2+rng()*4.2;
   const theta=member*2.39996+rng()*.7;
   const x=Math.cos(angle)*r+Math.cos(theta)*offset;
   const z=Math.sin(angle)*r+Math.sin(theta)*offset;
   o.position.set(x,heightAt(field.x+x,field.y+z)-centreHeight-.1,z);
   o.rotation.set((rng()-.5)*.24,rng()*Math.PI*2,(rng()-.5)*.25);
   const h=member===0?5+rng()*7:2.5+rng()*5;
   o.scale.set(h*(.30+rng()*.14),h,h*(.32+rng()*.12));
   o.updateMatrix();mesh.setMatrixAt(i,o.matrix);
   mesh.setColorAt(i,tints[(Math.floor(rng()*tints.length))%tints.length]);
  }
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  root.add(drapedMineralGround(field,heightAt,centreHeight,radius));
  root.add(mesh);scene.add(root);
  views.set(field.id,{root,mesh,ground:root.children[0],count});
 }
 return {
  sync(live){
   for(const field of live){
    const view=views.get(field.id);if(!view)continue;
    const ratio=Math.max(0,Math.min(1,field.amount/field.capacity));
    view.mesh.count=Math.max(0,Math.round(view.count*ratio));
    view.ground.material.opacity=.18+.64*ratio;
    view.root.visible=field.amount>0;
   }
  },
  dispose(){
   for(const view of views.values()){
    scene.remove(view.root);
    view.ground.geometry.dispose();
    view.ground.material.dispose();
    view.mesh.dispose();
   }
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
