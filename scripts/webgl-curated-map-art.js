import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {stoneMaterial,weatheredStoneGeometry} from './webgl-rock-materials.js';
import {planCuratedMapArt} from './webgl-curated-map-layout.js';

/** Hand-art-directed, performant 3D map identity. Nothing here affects
 * authoritative terrain, route grids, collision, Fog of War or saves.
 * Each multi-part landmark is baked ONCE into one PBR mesh per palette,
 * then repeated through GPU instancing: no animated per-frame allocations.
 */
const TAU=Math.PI*2;
function makeSculpture(type,lowQuality){
 const parts={stone:[],edge:[],metal:[],dark:[],accent:[],moss:[]};
 const piece=(group,geo,x=0,y=0,z=0,options={})=>{
  const {rotation=0,tilt=0,roll=0,scale=[1,1,1]}=options;
  geo.scale(...scale);
  if(tilt)geo.rotateX(tilt);
  if(roll)geo.rotateZ(roll);
  if(rotation)geo.rotateY(rotation);
  geo.translate(x,y,z);
  parts[group].push(geo);
 };
 const box=(group,x,y,z,w,h,d,options={})=>
  piece(group,new THREE.BoxGeometry(w,h,d),x,y,z,options);
 const cylinder=(group,x,y,z,rBottom,rTop,h,segments=10,options={})=>
  piece(group,new THREE.CylinderGeometry(rTop,rBottom,h,segments),x,y,z,options);
 const stone=(group,x,y,z,r,options={})=>
  piece(group,new THREE.DodecahedronGeometry(r,0),x,y,z,options);
 const ring=(group,x,y,z,r,t,options={})=>
  piece(group,new THREE.TorusGeometry(r,t,7,28),x,y,z,options);
 const beam=(group,a,b,r=2)=>{
  const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),dir=vb.clone().sub(va);
  const g=new THREE.CylinderGeometry(r,r,dir.length(),6);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
   new THREE.Vector3(0,1,0),dir.normalize()));
  g.translate(...va.add(vb).multiplyScalar(.5).toArray());
  parts[group].push(g);
 };
 if(type==='desert-refinery'){
  // One weathered water extraction station, like a C&C desert economy prop:
  // graded sandstone platform, industrial settling tanks, pipe arch and mast.
  cylinder('stone',0,9,0,100,93,18,12);
  cylinder('edge',0,18,0,91,91,8,12);
  cylinder('stone',-22,47,-10,47,48,58,16);
  cylinder('metal',-22,79,-10,51,51,6,16);
  cylinder('dark',-22,85,-10,44,44,5,16);
  ring('metal',-22,85,-10,37,2,{tilt:-Math.PI/2});
  for(let i=0;i<12;i++){
   const a=i*TAU/12;
   cylinder('metal',-22+49*Math.cos(a),48,-10+49*Math.sin(a),
    2.4,2.4,54,6);
  }
  // Two storage vessels with fluted ribs and a raised loading station.
  for(const x of [44,71]){
   cylinder('metal',x,35,28,14,14,38,12);
   cylinder('dark',x,56,28,15,15,4,12);
   ring('edge',x,17,28,14.7,2,{tilt:-Math.PI/2});
  }
  box('stone',42,27,-42,56,19,42);
  box('edge',42,40,-42,65,7,50);
  box('dark',42,46,-42,52,4,29,{tilt:-.09});
  for(let i=0;i<6;i++)
   box('metal',18+i*9,55,-50,1.4,24,2);
  beam('metal',[24,79,-10],[94,79,-10],5);
  beam('metal',[94,79,-10],[94,42,28],5);
  ring('metal',94,79,-10,9,3,{tilt:Math.PI/2});
  cylinder('metal',-70,65,46,7,9,83,9);
  cylinder('dark',-70,109,46,11,11,6,9);
  cylinder('accent',-70,115,46,8,8,4,8);
  for(let i=0;i<3;i++)box('edge',-44+i*28,5,88,18,10,9);
  for(let i=0;i<8;i++){
   const a=i*TAU/8;
   stone('stone',Math.cos(a)*91,3,Math.sin(a)*91,8,
    {rotation:a,scale:[1.05,.45,.84]});
  }
 }else if(type==='winter-watchtower'){
  // Snow-scarred defensive pass towers; amber optics, radar, girders,
  // elevated concrete blockhouse and layered blue-grey armor plating.
  cylinder('dark',0,3,0,65,64,15,8);
  cylinder('stone',0,12,0,57,53,20,8);
  cylinder('stone',0,68,0,37,39,102,8);
  cylinder('metal',0,122,0,53,49,12,8);
  cylinder('edge',0,132,0,55,47,12,8);
  cylinder('dark',0,139,0,47,43,5,8);
  cylinder('edge',0,149,0,44,4,16,8);
  for(let i=0;i<8;i++){
   const a=(i+.5)*TAU/8;
   const px=Math.cos(a)*41,pz=Math.sin(a)*41;
   box('metal',px,116,pz,10,31,8,{rotation:-a});
   box('dark',px*.87,105,pz*.87,14,13,3,{rotation:-a});
   box('edge',px,142,pz,15,9,13,{rotation:-a});
   beam('metal',[px*.91,23,pz*.91],[px*.91,104,pz*.91],2.2);
  }
  // Double horizontal snow eaves and structural corner brackets.
  for(const y of [27,88]){
   cylinder('edge',0,y,0,49,49,4,8);
  }
  beam('metal',[0,147,0],[0,205,0],3.3);
  beam('dark',[0,187,0],[28,199,0],1.9);
  piece('metal',new THREE.SphereGeometry(19,14,8),32,189,0,
   {scale:[1,.42,1]});
  box('accent',0,196,0,11,8,11);
  for(const z of [-33,33])box('edge',0,155,z,34,5,11,{tilt:-.12});
  for(let k=0;k<5;k++)stone('edge',-50+k*25,6,49,10,
   {scale:[1.2,.32,.83],rotation:k*.28});
 }else if(type==='jungle-temple'){
  // Overgrown cliff citadel with broken colonnades, stepped plinth,
  // sunken stone lintel and vines. Distinct silhouette from snow towers.
  for(let level=0;level<4;level++)
   box(level%2?'stone':'edge',0,8+level*9,0,
    145-level*13,12,111-level*11,{rotation:.035*level});
  box('dark',0,44,-5,105,6,62);
  for(const x of [-42,42]){
   for(const z of [-26,26]){
    cylinder('stone',x,81,z,11,13,77,6,{roll:(x>0?.035:-.05)});
    cylinder('edge',x,119,z,16,15,11,7);
    cylinder('dark',x,51,z,17,17,7,7);
   }
  }
  box('stone',0,130,0,126,24,52,{tilt:.045});
  box('edge',0,146,0,103,7,58,{roll:-.04});
  cylinder('dark',0,173,0,15,18,46,9);
  cylinder('moss',0,195,0,25,22,9,10);
  ring('accent',0,191,0,13,4,{rotation:.12,tilt:Math.PI/2});
  for(let i=0;i<12;i++){
   const a=i*TAU/12;
   const x=Math.cos(a)*61,z=Math.sin(a)*48;
   stone(i%3===0?'moss':'stone',x,24,z,11+i%3*3,
    {rotation:a,scale:[1.0,.52,.84]});
  }
  // Actual 3D cables and climbing vines: no billboard planes or textures.
  for(let i=0;i<(lowQuality?3:7);i++){
   const side=i%2?1:-1,x=side*(38+i%3*3),z=(i%4-1.5)*15;
   const a=new THREE.Vector3(x,139,z);
   const b=new THREE.Vector3(x+side*(4+i%3),87,z+8);
   const mid=new THREE.Vector3(x+side*(10+i%3*4),99,z-9);
   piece('moss',new THREE.TubeGeometry(
    new THREE.QuadraticBezierCurve3(a,mid,b),14,2.7,5,false));
  }
 }
 const out={};
 for(const [key,geometries] of Object.entries(parts)){
  if(!geometries.length)continue;
  const flat=geometries.map(g=>g.index?g.toNonIndexed():g);
  const merged=mergeGeometries(flat,false);
  geometries.forEach(g=>g.dispose());flat.forEach(g=>g.dispose());
  if(!merged)throw Error('Could not merge curated 3D model '+type+' '+key);
  merged.computeVertexNormals();merged.computeBoundingSphere();
  out[key]=merged;
 }
 return out;
}
function fernGeometry(){
 // Cluster of textured 3D tropical leaves, thicker than the existing
 // low-poly trees yet still a single instanced draw for hundreds of plants.
 const geometry=[];
 for(let i=0;i<9;i++){
  const theta=TAU*i/9;
  const leaf=new THREE.SphereGeometry(1,7,5);
  leaf.scale(5.2,1.4,19);
  leaf.rotateX(-.42+(i%3)*.18);
  leaf.rotateY(theta);
  leaf.translate(Math.cos(theta)*10,4+(i%3)*2,Math.sin(theta)*10);
  geometry.push(leaf.toNonIndexed());leaf.dispose();
 }
 const merged=mergeGeometries(geometry,false);
 geometry.forEach(g=>g.dispose());merged.computeVertexNormals();
 return merged;
}
export function createCuratedMapArt({scene,world,terrain,heightAt,preset,oases=[],
 lowQuality=false}){
 const plan=planCuratedMapArt({preset,world,terrain,oases});
 if(!plan)return {root:null,plan:null,drawCalls:0,dispose:()=>{}};
 const root=new THREE.Group(),resources=new Set(),half=world.size*.5;
 root.name='sandforge-curated-map-'+plan.id;
 root.userData={visualOnly:true,nonPlayable:true,authoredMap:true,
  revision:plan.revision};
 const materials={
  stone:stoneMaterial(plan.palette.stone,{lowQuality,normalScale:.8}),
  edge:stoneMaterial(plan.palette.edge,{lowQuality,normalScale:.65}),
  metal:new THREE.MeshStandardMaterial({
   color:plan.palette.metal,roughness:.63,metalness:.53}),
  dark:new THREE.MeshStandardMaterial({
   color:plan.palette.dark,roughness:.92,metalness:.12}),
  accent:new THREE.MeshStandardMaterial({
   color:plan.palette.accent,roughness:.32,metalness:.28,
   emissive:new THREE.Color(plan.palette.accent).multiplyScalar(.13)}),
  moss:new THREE.MeshStandardMaterial({
   color:plan.palette.moss,roughness:1,metalness:0,flatShading:false})
 };
 Object.values(materials).forEach(m=>resources.add(m));
 let drawCalls=0;
 for(const type of [...new Set(plan.landmarks.map(l=>l.type))]){
  const landmarks=plan.landmarks.filter(l=>l.type===type);
  const model=makeSculpture(type,lowQuality);
  for(const [category,geometry] of Object.entries(model)){
   resources.add(geometry);
   const mesh=new THREE.InstancedMesh(geometry,materials[category],landmarks.length);
   const dummy=new THREE.Object3D();
   for(let i=0;i<landmarks.length;i++){
    const p=landmarks[i];
    // Sink the plinth through bumpy relief, so no floating foundations.
    dummy.position.set(p.x-half,heightAt(p.x,p.y)-13,p.y-half);
    dummy.rotation.y=p.rotation??0;
    dummy.scale.setScalar(p.scale??1);
    dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
   }
   mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
   mesh.castShadow=category==='stone'||category==='metal';
   mesh.receiveShadow=true;mesh.raycast=()=>{};
   mesh.name='visual-curated-'+plan.id+'-'+type+'-'+category;
   mesh.userData={visualOnly:true,nonPlayable:true,
    landmark:type,map:plan.id,drawCallBudget:true};
   root.add(mesh);drawCalls++;
  }
 }
 const accent=plan.groundAccents;
 if(accent.length){
  const kind=accent[0].kind;
  const geom=kind==='dune-stone'?weatheredStoneGeometry(lowQuality):
   kind==='snowdrift'?new THREE.SphereGeometry(1,10,6):fernGeometry();
  const mat=kind==='dune-stone'?stoneMaterial('#c5a47b',{lowQuality,
   normalScale:.7}):new THREE.MeshStandardMaterial({
    color:kind==='snowdrift'?'#e3edf2':'#427c47',
    roughness:.98,metalness:0,side:THREE.DoubleSide});
  resources.add(geom);resources.add(mat);
  const mesh=new THREE.InstancedMesh(geom,mat,accent.length);
  const dummy=new THREE.Object3D();
  for(const [i,p] of accent.entries()){
   dummy.position.set(p.x-half,heightAt(p.x,p.y)-
    (kind==='snowdrift'?4:kind==='dune-stone'?2:1),p.y-half);
   dummy.rotation.set(0,p.rotation,0);
   const n=p.scale;
   if(kind==='snowdrift')dummy.scale.set(23*n,5*n,31*n);
   else if(kind==='dune-stone')dummy.scale.set(4*n,1.9*n,5*n);
   else dummy.scale.set(n*.9,n*.9,n*.9);
   dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
  mesh.castShadow=false;mesh.receiveShadow=true;mesh.raycast=()=>{};
  mesh.name='visual-curated-'+plan.id+'-'+kind;
  mesh.userData={visualOnly:true,nonPlayable:true,
   scenery:true,artRevision:plan.revision};
  root.add(mesh);drawCalls++;
 }
 scene.add(root);
 return {root,plan,drawCalls,dispose(){
  root.removeFromParent();root.clear();
  for(const resource of resources)resource.dispose();
 }};
}
