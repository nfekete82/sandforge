import * as THREE from 'three';

const triangles=g=>(g.index?.count??g.attributes.position.count)/3;

/** Linear-time vertex clustering, performed ONCE at asset load. Keep UV seams,
 * hard normal boundaries, material groups and the source geometry intact.
 * Only explicitly registered decoration is eligible; never terrain or actors. */
export function clusterDecorationGeometry(source,cells=24){
 if(!source.attributes.uv||!source.attributes.normal||source.morphAttributes.position?.length)
  return source;
 source.computeBoundingBox();
 const extent=source.boundingBox.getSize(new THREE.Vector3());
 const step=Math.max(extent.x,extent.y,extent.z)/cells;
 if(!step||triangles(source)<80)return source;
 const attrs=Object.entries(source.attributes);
 if(attrs.some(([,a])=>a.normalized))return source;
 const buckets=new Map(),vertices=[],remap=new Uint32Array(source.attributes.position.count);
 const p=source.attributes.position,uv=source.attributes.uv,n=source.attributes.normal;
 for(let i=0;i<p.count;i++){
  // UV and normal bins prevent joining opposite sides or texture islands.
  const key=[Math.round(p.getX(i)/step),Math.round(p.getY(i)/step),Math.round(p.getZ(i)/step),
   Math.round(uv.getX(i)*cells),Math.round(uv.getY(i)*cells),
   Math.round(n.getX(i)*2),Math.round(n.getY(i)*2),Math.round(n.getZ(i)*2)].join(',');
  let vertex=buckets.get(key);
  if(vertex===undefined){vertex=vertices.length;buckets.set(key,vertex);vertices.push(i);}
  remap[i]=vertex;
 }
 const indices=[],groups=source.groups.length?source.groups:[{start:0,count:triangles(source)*3,materialIndex:0}];
 const result=new THREE.BufferGeometry();
 for(const group of groups){
  const start=indices.length;
  for(let i=group.start;i<group.start+group.count;i+=3){
   const a=remap[source.index?source.index.getX(i):i],
    b=remap[source.index?source.index.getX(i+1):i+1],
    c=remap[source.index?source.index.getX(i+2):i+2];
   if(a!==b&&a!==c&&b!==c)indices.push(a,b,c);
  }
  result.addGroup(start,indices.length-start,group.materialIndex);
 }
 if(indices.length>=triangles(source)*3*.92||!indices.length){result.dispose();return source;}
 for(const [name,attribute] of attrs){
  const data=new attribute.array.constructor(vertices.length*attribute.itemSize);
  for(let i=0;i<vertices.length;i++)for(let j=0;j<attribute.itemSize;j++)
   data[i*attribute.itemSize+j]=attribute.getComponent(vertices[i],j);
  result.setAttribute(name,new THREE.BufferAttribute(data,attribute.itemSize));
 }
 result.setIndex(indices);result.computeBoundingSphere();result.computeBoundingBox();
 result.userData={visualOnly:true,decorationLOD:true};
 return result;
}

export function decorationLodLevel(pixels,previous=0,bias=1){
 const near=64*bias,far=32*bias,h=.15;
 if(previous===0)return pixels<near*(1-h)?(pixels<far*(1-h)?2:1):0;
 if(previous===1)return pixels>near*(1+h)?0:pixels<far*(1-h)?2:1;
 return pixels>far*(1+h)?(pixels>near*(1+h)?0:1):2;
}

/** Swap ONE shared geometry on an existing instanced batch. No extra draws,
 * instance uploads, material variants, scene traversal or allocations per frame.
 * Orthographic RTS zoom uses CSS projected size, independent of dynamic DPR. */
export class SmartDecorationLOD{
 constructor({enabled=true}={}){
  this.enabled=enabled;this.entries=[];this.cache=new Map();this.nextUpdate=0;this.bias=1;
  this.matrix=new THREE.Matrix4();this.center=new THREE.Vector3();this.worldCenter=new THREE.Vector3();
 }
 register(mesh){
  const materials=Array.isArray(mesh?.material)?mesh.material:[mesh?.material];
  if(!mesh?.isInstancedMesh||!materials.every(m=>m?.map&&m.normalMap&&m.roughnessMap)||
   this.entries.some(e=>e.mesh===mesh))return false;
  const source=mesh.geometry;
  let levels=this.cache.get(source);
  if(!levels){levels=[source,clusterDecorationGeometry(source,24),clusterDecorationGeometry(source,16)];this.cache.set(source,levels);}
  if(levels.every(g=>g===source))return false;
  source.computeBoundingSphere();
  let scale=0;
  for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,this.matrix);scale=Math.max(scale,this.matrix.getMaxScaleOnAxis());}
  mesh.computeBoundingSphere();mesh.updateMatrixWorld(true);
  const radius=source.boundingSphere.radius*scale;
  this.entries.push({mesh,levels,source,radius,level:0,castShadow:mesh.castShadow});
  return true;
 }
 setVisualQuality(level){this.bias=level?1.25:1;this.shadowReduced=level>0;this.nextUpdate=0;}
 setEnabled(enabled){this.enabled=!!enabled;this.nextUpdate=0;}
 update(camera,cssHeight,now){
  if(now<this.nextUpdate)return;this.nextUpdate=now+200;
  for(const e of this.entries){
   const scale=e.mesh.matrixWorld.getMaxScaleOnAxis();
   let pixels;
   if(camera.isOrthographicCamera)pixels=2*e.radius*scale*camera.zoom*cssHeight/(camera.top-camera.bottom);
   else{
    this.worldCenter.copy(e.mesh.boundingSphere.center).applyMatrix4(e.mesh.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
    const depth=Math.max(camera.near,-this.worldCenter.z-e.mesh.boundingSphere.radius*scale);
    pixels=e.radius*scale*cssHeight/(depth*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5)));
   }
   const level=this.enabled?decorationLodLevel(pixels,e.level,this.bias):0;
   e.mesh.geometry=e.level===level?e.mesh.geometry:e.levels[level];e.level=level;
   e.mesh.castShadow=e.castShadow&&!(this.shadowReduced&&level===2);
  }
 }
 snapshot(){return {enabled:this.enabled,batches:this.entries.length,levels:this.entries.map(e=>e.level),
  sourceTriangles:this.entries.reduce((s,e)=>s+triangles(e.source)*e.mesh.count,0),
  activeTriangles:this.entries.reduce((s,e)=>s+triangles(e.mesh.geometry)*e.mesh.count,0)};}
 dispose(){
  for(const e of this.entries){e.mesh.geometry=e.source;e.mesh.castShadow=e.castShadow;}
  for(const [source,levels] of this.cache)for(const g of new Set(levels))if(g!==source)g.dispose();
  this.entries.length=0;this.cache.clear();
 }
}
