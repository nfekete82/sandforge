#!/usr/bin/env node
/** Meshy 7.1 --> Sandforge. Split the real corrugated door triangles from
 * the original quantized PBR GLB without repainting or remeshing the roof.
 * The game-facing factory-0/1.glb preserve the original Meshy UVs, basecolor,
 * normal and metallic/roughness textures byte-for-byte.
 */
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
export const MESHY_FACTORY_VERSION='sandforge-meshy-pbr-production-gate-v1-20261121';
export const MESHY_DOOR_HEIGHT=.330;
const SOURCE=process.argv[2]??'src/assets/reborn/buildings-3d/factory-meshy-optimized.glb';
const OUT=process.argv[3]??dirname(SOURCE);
const align4=n=>(n+3)&~3;
function readGLB(b){
 if(b.length<40||b.toString('ascii',0,4)!=='glTF'||
    b.readUInt32LE(4)!==2||b.readUInt32LE(8)!==b.length)
  throw new Error('Invalid glTF 2 binary');
 let offset=12;const chunks=[];
 while(offset<b.length){
  const size=b.readUInt32LE(offset),type=b.toString('ascii',offset+4,offset+8);
  if(size%4||offset+8+size>b.length)throw new Error('Invalid glTF chunk length');
  chunks.push({type,bytes:Buffer.from(b.subarray(offset+8,offset+8+size))});
  offset+=8+size;
 }
 if(chunks[0]?.type!=='JSON'||chunks[1]?.type!=='BIN\0')
  throw new Error('Missing GLB JSON/BIN chunks');
 return {doc:JSON.parse(chunks[0].bytes.toString('utf8')),bin:chunks[1].bytes};
}
function saveGLB(doc,bin){
 const json=Buffer.from(JSON.stringify(doc));
 const payloads=[['JSON',Buffer.concat([json,Buffer.alloc(align4(json.length)-json.length,32)])],
  ['BIN\0',Buffer.concat([bin,Buffer.alloc(align4(bin.length)-bin.length)])]];
 const size=12+payloads.reduce((n,[,b])=>n+8+b.length,0),out=Buffer.alloc(size);
 out.write('glTF',0,4,'ascii');out.writeUInt32LE(2,4);out.writeUInt32LE(size,8);
 let ptr=12;for(const [type,bytes] of payloads){
  out.writeUInt32LE(bytes.length,ptr);out.write(type,ptr+4,4,'ascii');
  bytes.copy(out,ptr+8);ptr+=8+bytes.length;
 }
 return out;
}
function quantPositions(doc,bin,id){
 const a=doc.accessors[id],v=doc.bufferViews[a.bufferView];
 if(a.componentType!==5123||a.type!=='VEC3'||a.sparse)
  throw new Error('Meshy vertex quantization unexpectedly changed');
 const offset=(v.byteOffset??0)+(a.byteOffset??0),step=v.byteStride??6;
 const vertices=new Array(a.count);
 for(let i=0;i<a.count;i++){
  const p=offset+i*step;
  vertices[i]=[bin.readUInt16LE(p),bin.readUInt16LE(p+2),bin.readUInt16LE(p+4)];
 }
 return vertices;
}
function extractRealShutter(doc,bin){
 const index=doc.nodes.findIndex(n=>n.mesh!==undefined),node=doc.nodes[index];
 const mesh=doc.meshes[node.mesh],primitive=mesh.primitives?.[0];
 if(mesh.primitives.length!==1||primitive.indices===undefined)
  throw new Error('Expected original Meshy single-PBR indexed mesh');
 const accessor=doc.accessors[primitive.indices],view=doc.bufferViews[accessor.bufferView];
 if(accessor.componentType!==5125||accessor.type!=='SCALAR'||accessor.count%3)
  throw new Error('Expected 32-bit Meshy triangle indices');
 const vertices=quantPositions(doc,bin,primitive.attributes.POSITION);
 const translate=node.translation??[0,0,0],scale=node.scale??[1,1,1];
 const at=i=>vertices[i].map((n,k)=>n*scale[k]+translate[k]);
 const ptr=(view.byteOffset??0)+(accessor.byteOffset??0),stay=[],door=[];
 for(let i=0;i<accessor.count;i+=3){
  const indices=[bin.readUInt32LE(ptr+i*4),
   bin.readUInt32LE(ptr+(i+1)*4),bin.readUInt32LE(ptr+(i+2)*4)];
  if(indices.some(n=>n>=vertices.length))throw new Error('Invalid Meshy index');
  const [a,b,c]=indices.map(at);
  const p=a.map((n,k)=>(n+b[k]+c[k])/3),[x,y,z]=p;
  const e=b.map((n,k)=>n-a[k]),f=c.map((n,k)=>n-a[k]);
  const nx=e[1]*f[2]-e[2]*f[1],ny=e[2]*f[0]-e[0]*f[2],
   nz=e[0]*f[1]-e[1]*f[0];
  const unitX=nx/(Math.hypot(nx,ny,nz)||1);
  const zmin=-.662+(y+.350)*.110/.320-.012;
  const zmax=-.180-(y+.350)*.120/.320+.012;
  const gate=x>-.525&&x<-.395&&y>-.357&&y<-.022&&
   z>zmin&&z<zmax&&unitX<-.12;
  (gate?door:stay).push(...indices);
 }
 const triangles=door.length/3;
 if(triangles<450||triangles>1300)throw new Error('Unable to isolate Meshy garage shutter '+triangles);
 if(stay.length+door.length!==accessor.count)throw new Error('Index partition mismatch');
 for(let i=0;i<stay.length;i++)bin.writeUInt32LE(stay[i],ptr+i*4);
 for(let i=0;i<door.length;i++)bin.writeUInt32LE(door[i],ptr+(stay.length+i)*4);
 view.byteLength=stay.length*4;accessor.count=stay.length;
 const viewId=doc.bufferViews.length;
 doc.bufferViews.push({buffer:view.buffer,byteOffset:ptr+stay.length*4,
  byteLength:door.length*4,target:34963});
 const accessorId=doc.accessors.length;
 doc.accessors.push({bufferView:viewId,byteOffset:0,componentType:5125,
  count:door.length,type:'SCALAR'});
 const meshId=doc.meshes.length;
 doc.meshes.push({name:'FactoryRollupDoor',primitives:[{
  attributes:{...primitive.attributes},indices:accessorId,material:primitive.material
 }]});
 const doorId=doc.nodes.length;
 doc.nodes.push({name:'FactoryRollupDoor',mesh:meshId,
  translation:[...node.translation],scale:[...node.scale],
  extras:{realMeshyShutter:true,openHeight:MESHY_DOOR_HEIGHT,
   closedY:node.translation[1],originalScaleY:node.scale[1]}});
 const parent=doc.nodes.find(n=>n.children?.includes(index));
 if(!parent)throw new Error('No parent for authored Meshy shutter');
 parent.children.push(doorId);
 return {realDoorTriangles:triangles,intactFactoryTriangles:stay.length/3};
}
export function prepareMeshyFactory(src=SOURCE,output=OUT){
 if(!existsSync(src))return {status:'source-missing'};
 const bytes=readFileSync(src);
 if(bytes.length<30000||bytes.length>12000000)
  throw new Error('Expected optimized Meshy PBR source GLB, not high-poly original');
 const parsed=readGLB(bytes),doc=parsed.doc;
 if(!doc.materials?.some(m=>m.normalTexture&&
  m.pbrMetallicRoughness?.baseColorTexture&&
  m.pbrMetallicRoughness?.metallicRoughnessTexture))
  throw new Error('Missing real Meshy PBR texture maps');
 mkdirSync(output,{recursive:true});const out=[];
 for(let owner=0;owner<2;owner++){
  const model=structuredClone(doc),bin=Buffer.from(parsed.bin);
  const stats=extractRealShutter(model,bin),roots=model.scenes[model.scene??0].nodes;
  const wrapper=model.nodes.length;
  // Original Meshy garage faces -X. Rotate +90° Y: real shutter faces +Z
  // exactly like Sandforge barracks and 4-cardinal vehicle production.
  model.nodes.push({name:'SF_Factory_Meshy_ProductionRig',
   rotation:[0,Math.SQRT1_2,0,Math.SQRT1_2],children:[...roots],
   extras:{source:'Meshy 7.1',realMeshyProduction:true,owner,
    frontLocalPlusZ:true,realShutter:true}});
  for(const [name,translation] of [
   // These markers are children of the +90° Y-rotated factory root.
   // Authored here in ORIGINAL -X-facing source coordinates so their world
   // positions line up with the actual cut shutter (+Z after rotation).
   ['SF_Factory_Meshy_RolloutStart',[-.16,-.292,-.425]],
   ['SF_Factory_Meshy_RolloutExit',[-.74,-.345,-.425]]]){
   const i=model.nodes.length;
   model.nodes.push({name,translation,extras:{visualOnly:true,nonBlocking:true}});
   model.nodes[wrapper].children.push(i);
  }
  model.scenes[model.scene??0].nodes=[wrapper];
  model.asset.generator=MESHY_FACTORY_VERSION;
  model.asset.extras={originalMeshyPBR:true,owner,teamPaintShader:owner===1,
   productionGateway:true,...stats};
  const file=join(output,'factory-'+owner+'.glb'),glb=saveGLB(model,bin);
  writeFileSync(file,glb);
  out.push({owner,file,bytes:glb.length,...stats});
 }
 return {status:'ready',output:out};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 console.log('Sandforge Meshy production GLB:',JSON.stringify(prepareMeshyFactory()));
