import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {planBurnedSedans,BURNED_SEDAN_ART_VERSION} from './webgl-burned-sedan-plan.js';
import {addBurnedSedanDebris} from './webgl-burned-sedan-debris-3d.js';

/** Real 3D authored-style burnt civilian sedan, not a billboard or a
 * rectangular decal. Each damaged shell is 5 merged PBR submeshes. All
 * repeated copies are GPU-instanced; the battlefield physics is untouched.
 */
const TYPES=['shell','char','iron','rubber','glass'];
const GOLDEN=.618033988749895;
function hash(x,y,s=1){
 let n=Math.imul(x+Math.imul(y,131),374761393)^Math.imul(s,668265263);
 n=Math.imul(n^(n>>>13),1274126177);
 return ((n^(n>>>16))>>>0)/4294967295;
}
function mapTexture(width,kind){
 const bytes=new Uint8Array(width*width*4),height=new Float32Array(width*width);
 for(let y=0;y<width;y++)for(let x=0;x<width;x++){
  const n=hash(x>>3,y>>3,12),fine=hash(x,y,87),
   p=hash(x>>5,y>>5,237),w=Math.sin(x*.083+y*.067)*Math.cos(y*.11-x*.072);
  const rust=Math.min(1,Math.max(0,(n*.62+p*.25+fine*.13+w*.08-.39)*2.5));
  const char=Math.min(1,Math.max(0,((p<.27?1:0)*.45+
   (Math.sin(x*.059-y*.067+3)+Math.cos(y*.047+x*.022-1))*.17+
    (n<.26?.28:0))));
  const salt=(fine-.5)*35;
  const light=[179+salt,164+salt,138+salt],
   oxide=[118+salt,72+salt*.6,43+salt*.4],
   soot=[42+salt*.4,40+salt*.3,37+salt*.2];
  const blend=(a,b,t)=>a*(1-t)+b*t;
  const base=light.map((c,i)=>blend(blend(c,oxide[i],rust*.85),soot[i],char*.92));
  const k=(y*width+x)*4;
  if(kind==='albedo'){
   for(let ch=0;ch<3;ch++)bytes[k+ch]=Math.max(0,Math.min(255,base[ch]));
  }else if(kind==='roughness'){
   const r=Math.round(218+21*rust+11*char+(fine-.5)*10);
   bytes[k]=bytes[k+1]=bytes[k+2]=r;
  }else{
   const grain=hash(x+1,y,87)-hash(x-1,y,87);
   const sediment=hash(x,y+1,87)-hash(x,y-1,87);
   const dx=grain*.34,dy=sediment*.34;
   const inv=1/Math.hypot(dx,dy,1);
   bytes[k]=Math.round((-.5*dx*inv+.5)*255);
   bytes[k+1]=Math.round((-.5*dy*inv+.5)*255);
   bytes[k+2]=Math.round((.5*inv+.5)*255);
  }
  bytes[k+3]=255;
 }
 const texture=new THREE.DataTexture(bytes,width,width,THREE.RGBAFormat);
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
 texture.minFilter=THREE.LinearMipmapLinearFilter;
 texture.magFilter=THREE.LinearFilter;
 texture.generateMipmaps=true;texture.flipY=false;
 if(kind==='albedo')texture.colorSpace=THREE.SRGBColorSpace;
 texture.needsUpdate=true;
 return texture;
}
function makeMaterials(lite=false){
 const width=lite?128:256,paint=mapTexture(width,'albedo'),
  rough=mapTexture(width,'roughness'),normal=mapTexture(width,'normal');
 const materials={
  shell:new THREE.MeshStandardMaterial({color:'#ffffff',map:paint,roughnessMap:rough,
   normalMap:normal,normalScale:new THREE.Vector2(.53,.53),
   metalness:.32,roughness:.94,side:THREE.DoubleSide}),
  char:new THREE.MeshStandardMaterial({color:'#2b2927',roughness:1,metalness:.20,
   flatShading:true,side:THREE.DoubleSide}),
  iron:new THREE.MeshStandardMaterial({color:'#86634c',roughness:.91,metalness:.69,
   flatShading:true,side:THREE.DoubleSide}),
  rubber:new THREE.MeshStandardMaterial({color:'#181716',roughness:1,metalness:.04,
   flatShading:true,side:THREE.DoubleSide}),
  glass:new THREE.MeshStandardMaterial({color:'#8e9b99',transparent:true,opacity:.54,
   metalness:.08,roughness:.23,depthWrite:false,side:THREE.DoubleSide})
 };
 return {materials,textures:[paint,rough,normal]};
}
function sheet(points){
 const geo=new THREE.BufferGeometry(),v=[],uv=[];
 // Fan for torn, uneven panels. UVs are world-ish continuous.
 for(let i=1;i<points.length-1;i++)for(const p of [points[0],points[i],points[i+1]]){
  v.push(...p);
  uv.push(p[0]*.031+p[2]*.007,p[1]*.028+p[2]*.012);
 }
 geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.computeVertexNormals();
 return geo;
}
function makeSedanGeometry(variant){
 const parts=Object.fromEntries(TYPES.map(t=>[t,[]]));
 const matrix=new THREE.Matrix4(),rot=new THREE.Euler(),q=new THREE.Quaternion();
 function add(type,geo,x=0,y=0,z=0,rx=0,ry=0,rz=0){
  if(!parts[type])throw Error('Unknown sedan material '+type);
  rot.set(rx,ry,rz);q.setFromEuler(rot);
  matrix.compose(new THREE.Vector3(x,y,z),q,new THREE.Vector3(1,1,1));
  geo.applyMatrix4(matrix);
  const prepared=geo.index?geo.toNonIndexed():geo;
  if(prepared!==geo)geo.dispose();
  parts[type].push(prepared);
 }
 const block=(type,w,h,d,x,y,z,rx=0,ry=0,rz=0)=>
  add(type,new THREE.BoxGeometry(w,h,d),x,y,z,rx,ry,rz);
 const panel=(type,vertices)=>add(type,sheet(vertices));
 const rod=(type,a,b,r=.9,steps=5)=>{
  const p=new THREE.Vector3(...a),to=new THREE.Vector3(...b),mid=p.clone().add(to).multiplyScalar(.5);
  const geo=new THREE.CylinderGeometry(r,r*.93,p.distanceTo(to),steps);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
   new THREE.Vector3(0,1,0),to.sub(p).normalize()));
  add(type,geo,mid.x,mid.y,mid.z);
 };
 // Hollow, crushed body shell. No full-body box: visible empty windows
 // and perforated cabin show the scorched interior through the walls.
 block('iron',31,2.5,70,0,6,0);
 for(const side of [-1,1]){
  block('shell',1.9,10.7,62,side*16.2,12,-1);
  block('iron',1.7,2.9,67,side*15.9,7.2,-1);
  // Four doors remain recognizable through their split seam / handles.
  for(const z of [-8.8,10.0]){
   block('char',.65,11,1.1,side*17.3,12.5,z);
   block('iron',.55,.85,5.7,side*17.6,17,z+5);
   // Blackened irregular burn marks across the lower door skins.
   panel('char',[[side*17.4,9,z-6],[side*17.6,14,z-4],
    [side*17.65,12.5,z+3.4],[side*17.4,8.6,z+7]]);
  }
  block('shell',2.2,6.5,22,side*16,16.8,-28);
  block('shell',2.4,7.5,17,side*16,16.8,28);
  // Engine-bay and cabin roof stand on individual bent A/B/C pillars.
  rod('iron',[side*15.2,18.7,-17],[side*10.5,32.7,-9.5],1.45,6);
  rod('iron',[side*15.5,18.3,5.0],[side*11.3,32.7,5.1],1.25,6);
  rod('iron',[side*15.6,19.4,22],[side*10.5,32.0,13.1],1.45,6);
  rod('char',[side*15.6,19.1,-18],[side*11.7,32.5,-10],.7,5);
  // Open side windows: small jagged glass remnants, not a solid sheet.
  for(let k=0;k<3;k++){
   const zz=(k-1)*5.8+1.2,yy=20+((k+variant)%3)*1.5;
   panel('glass',[[side*15.7,yy,zz],
    [side*14.6,yy+4.1,zz+.55],[side*15.2,yy+1.5,zz+3.8]]);
  }
 }
 // Bent and partly torn hood, with a central gap revealing the engine.
 panel('shell',[[-15,19,-16],[-15.4,20,-36],[-8,20.9,-40],
  [-4,21.3,-30],[-3.5,20,-18]]);
 panel('shell',[[4.3,19.1,-17],[3.7,21.7,-30],[8,20.5,-39],
  [15,18.2,-35],[15,19,-15]]);
 panel('char',[[-10,20.4,-30],[-5.2,21.1,-33],[-2,20,-23],
  [-6,19.5,-19]]);
 panel('char',[[5,21,-34],[13,20,-34],[9,20,-23],
  [1.4,20,-26]]);
 // Engine block, hoses and visible ash under warped bonnet.
 block('iron',17,7,16,0,15,-28);
 for(let i=0;i<4;i++){
  rod('char',[-7+i*4,17,-24],[-5+i*4,21,-30],.85,5);
 }
 block('iron',12,1.8,6,-1,20,-25,0,.21,0);
 // Trunk lid: broken, kicked upward metal; one corner open.
 panel('shell',[[-16,19,20],[-16,19.5,38],[4.5,19,38],
  [14,20,31],[15,19,20]]);
 panel('char',[[8,19.9,23],[15,20,30],[5,20.5,36]]);
 // Main roof ring, two bent roof tongues, deliberate large burned-out hole.
 rod('iron',[-10.4,32.5,-9.5],[10.3,33.0,-9.3],1.3);
 rod('iron',[-10,31.6,13.2],[10.3,31.3,13.6],1.3);
 rod('iron',[-11.2,32.4,-9],[-11.6,31.4,13.5],1.1);
 rod('iron',[10.8,32.1,-9],[11.1,31.4,13.5],1.2);
 if(variant===0){
  panel('shell',[[-11.2,33,-9],[-6.5,35.6,-9.7],
   [-2.5,33.4,-4],[-5.0,33.7,1.5],[-1.2,32.2,4],
   [-8,32.2,9],[-11,31.7,13]]);
  panel('shell',[[11,32,-9.0],[5.5,32.8,-9.4],
   [3,31.5,-4],[7,31.9,0],[5.7,31,8],[10.7,31,13]]);
 }else{
  panel('shell',[[-11,32.6,-9],[-3,34.6,-9],[1,29,-1],
   [-6.3,30.5,5],[-3.4,30,12],[-11.5,31.3,13]]);
  panel('shell',[[11,33,-9],[7.8,31.3,-9],[4.5,31.2,-2],
   [7,28,6],[2,29.4,12],[11.4,31.8,13]]);
 }
 // The hole remains pitch dark and OPEN, not patched by opaque geometry.
 for(let k=0;k<5;k++){
  const x=-7+k*3.6,z=variant===0?4.7:1.3;
  panel('char',[[x,31.4,z],[x+1.3,29.2,z+1.4],[x+2.2,31.1,z+.9]]);
 }
 // Burnt seats, steering wheel, dashboard inside the open cabin.
 for(const side of [-1,1]){
  block('char',8.1,2.3,9,side*6.2,13.3,-1.6);
  block('char',8.3,12,2.6,side*6.2,20,-.2,.17);
  for(let j=0;j<3;j++)block('iron',.75,10,.75,side*6.2-3+j*3,20,-.1);
 }
 block('char',24,2.2,8,0,13.4,16.7);
 block('char',26,2.3,3.6,0,19,-12.5,.16);
 add('iron',new THREE.TorusGeometry(4.2,.62,4,12),-5.7,21,-8.8,-.40,0,0);
 rod('iron',[-5.7,21,-8.8],[-5.7,19,-13],.85);
 for(let k=0;k<4;k++)rod('iron',[-8+k*5.4,12.5,16],[-8+k*5.4,19.5,16],.45);
 // Front: stripped empty lamps, grilled-out frame and dented bumper.
 block('char',30,7,2.0,0,13.9,-39.2);
 for(const x of [-11,11]){
  block('char',7.5,5.2,1.6,x,16.6,-40.4);
  block('iron',5.8,.85,1.8,x,19.1,-41.4);
  block('iron',5.6,.85,1.8,x,14.0,-41.4);
 }
 for(let i=0;i<4;i++)block('iron',15,.8,1.8,0,12.2+i*1.6,-41.5);
 block('iron',34,2.7,3.4,-1.6,8,-42.5,.0,.0,.08);
 block('char',30,4.3,1.2,0,12,39.3);
 block('iron',32,2.3,2.2,1,8,41.5,.03,.05,-.06);
 for(const x of [-12,12])block('char',5,3,.9,x,15,40);
 // Wheel arches are open. Melted tires are flattened, with rusty steel rims.
 for(const z of [-24,24])for(const side of [-1,1]){
  const x=side*18.5;
  const tyre=new THREE.CylinderGeometry(9.4,9.2,5.1,14,1);
  tyre.scale(.78,1,1); // after 90deg rotation: flattened in world Y
  add('rubber',tyre,x,9.2,z,0,0,Math.PI/2);
  // Broken strip of tire droops into sand below one wheel.
  if((z>0&&side<0)||(z<0&&side>0)){
   block('rubber',2.3,2.3,12.1,x+side*.7,2,z+4,.2,.35);
  }
  add('iron',new THREE.CylinderGeometry(5.65,5.65,.68,12),x+side*2.9,9.2,z,0,0,Math.PI/2);
  const rimX=x+side*3.45;
  add('iron',new THREE.TorusGeometry(4.7,.72,5,12),rimX,9.2,z,0,Math.PI/2);
  add('char',new THREE.CylinderGeometry(1.3,1.3,.9,7),rimX+side*.6,9.2,z,0,0,Math.PI/2);
  for(let spoke=0;spoke<5;spoke++){
   const angle=spoke*Math.PI*2/5;
   rod('iron',[rimX,9.2,z],[rimX,9.2+Math.cos(angle)*4.1,z+Math.sin(angle)*4.1],.60,4);
  }
 }
 // Scattered welded metal, char and broken glass, especially on variant B.
 if(variant===1){
  panel('iron',[[-11,19.3,-40],[-5,21.3,-35],[1,17.6,-42]]);
  rod('iron',[-14,17,18],[-18,12,27],.8);
 }
 const geometry={};
 for(const type of TYPES){
  const members=parts[type];
  geometry[type]=members.length?mergeGeometries(members,false):null;
  for(const member of members)member.dispose();
  if(!geometry[type])throw Error('Burned sedan '+type+' geometry could not be merged');
  geometry[type].computeBoundingSphere();
 }
 return geometry;
}
export function createBurnedSedanWrecks({
 scene,world,terrain=world?.generated,seed=world?.seed??0,mapId=null,
 heightAt,lowQuality=false
}){
 const placements=planBurnedSedans({world,terrain,seed,mapId,lowQuality});
 const root=new THREE.Group();root.name='visual-burned-sedan-wrecks';
 root.userData={visualOnly:true,nonPlayable:true,nonBlocking:true,
  decorativeWreck:true,revision:BURNED_SEDAN_ART_VERSION,count:placements.length};
 if(!placements.length)return {
  root,placements,debris:[],debrisDrawCalls:0,drawCalls:0,triangles:0,dispose:()=>{}
 };
 const {materials,textures}=makeMaterials(lowQuality),
  geometries=[makeSedanGeometry(0),makeSedanGeometry(1)],
  dummy=new THREE.Object3D();
 const size=world.size,meshes=[];
 for(const variant of [0,1]){
  const selected=placements.filter(p=>p.variant===variant);
  if(!selected.length)continue;
  for(const type of TYPES){
   const mesh=new THREE.InstancedMesh(geometries[variant][type],materials[type],selected.length);
   mesh.name='visual-burned-sedan-'+variant+'-'+type;
   mesh.userData={visualOnly:true,nonPlayable:true,nonBlocking:true,
    burnedSedan:true,variant,material:type};
   mesh.castShadow=!lowQuality&&type==='shell';
   mesh.receiveShadow=type!=='glass';
   mesh.raycast=()=>{};
   for(const [index,p] of selected.entries()){
    dummy.position.set(p.x-size*.5,heightAt(p.x,p.y)+.65,
      p.y-size*.5);
    dummy.rotation.set(p.lean,p.angle,(variant===1?-.015:.01));
    dummy.scale.setScalar(p.scale);
    dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);
   }
   mesh.instanceMatrix.needsUpdate=true;
   mesh.computeBoundingSphere();
   root.add(mesh);meshes.push(mesh);
  }
 }
 // Scatter a physically separate, nearby debris cluster for each sedan.
 // Reuse the same shared weathered/charred PBR textures and materials. The
 // eight additional part meshes are GPU-instanced, not one draw per scrap.
 const debris=addBurnedSedanDebris({
  root,world,terrain,seed,cars:placements,lowQuality,materials,heightAt
 });
 root.userData.debrisCount=debris.placements.length;
 scene.add(root);
 const triangles=meshes.reduce((n,m)=>n+m.count*
  m.geometry.getAttribute('position').count/3,0)+debris.triangles;
 let disposed=false;
 return {
  root,placements,debris:debris.placements,
  debrisDrawCalls:debris.drawCalls,
  drawCalls:meshes.length+debris.drawCalls,triangles,
  dispose(){
   if(disposed)return;
   disposed=true;root.removeFromParent();
   debris.dispose();
   for(const shape of geometries)for(const g of Object.values(shape))g.dispose();
   for(const mat of Object.values(materials))mat.dispose();
   for(const texture of textures)texture.dispose();
  }
 };
}
