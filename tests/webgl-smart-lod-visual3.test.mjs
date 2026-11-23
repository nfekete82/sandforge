import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {clusterDecorationGeometry,decorationLodLevel,SmartDecorationLOD} from '../scripts/webgl-smart-lod.js';
import {SandforgeVisualPost,BLOOM_LAYER,markTechnicalGlow} from '../scripts/webgl-visual-post.js';

function sandstone(){
 const bytes=readFileSync(new URL('../src/assets/reborn/desert-ecoregions/sandstone-pbr.glb',import.meta.url));
 const jsonLength=bytes.readUInt32LE(12),doc=JSON.parse(bytes.toString('utf8',20,20+jsonLength));
 const bin=bytes.subarray(28+jsonLength),primitive=doc.meshes[0].primitives[0];
 const g=new THREE.BufferGeometry();
 const attribute=id=>{
  const a=doc.accessors[id],v=doc.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3}[a.type];
  const start=(v.byteOffset??0)+(a.byteOffset??0),T={5126:Float32Array,5125:Uint32Array,5123:Uint16Array}[a.componentType];
  const data=new T(a.count*n),view=new DataView(bin.buffer,bin.byteOffset,bin.byteLength);
  const read={5126:'getFloat32',5125:'getUint32',5123:'getUint16'}[a.componentType];
  for(let i=0;i<a.count;i++)for(let j=0;j<n;j++)
   data[i*n+j]=view[read](start+i*(v.byteStride??n*T.BYTES_PER_ELEMENT)+j*T.BYTES_PER_ELEMENT,true);
  return new THREE.BufferAttribute(data,n);
 };
 for(const [key,name] of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']])g.setAttribute(name,attribute(primitive.attributes[key]));
 g.setIndex(attribute(primitive.indices));return g;
}
const textured=()=>{
 const map=new THREE.DataTexture(new Uint8Array([180,160,130,255]),1,1);
 map.colorSpace=THREE.SRGBColorSpace;
 return new THREE.MeshStandardMaterial({map,normalMap:new THREE.DataTexture(),roughnessMap:new THREE.DataTexture()});
};

test('real authored sandstone LOD retains UVs, normals, groups and source within bounded positional error',()=>{
 const source=sandstone(),before=source.index.array.slice();
 source.computeBoundingBox();
 for(const cells of [24,16]){
  const low=clusterDecorationGeometry(source,cells);
  assert.notEqual(low,source);assert.ok(low.index.count<source.index.count*.92);
  for(const attr of ['position','normal','uv'])assert.ok(low.attributes[attr]);
  assert.equal(low.groups[0].materialIndex,0);
  assert.ok(source.boundingBox.containsBox(low.boundingBox));
  assert.ok([...low.attributes.uv.array].every(Number.isFinite));
 }
 assert.deepEqual(source.index.array,before);
});

test('orthographic zoom and hysteresis switch shared batches without changing materials or instances',()=>{
 const lod=new SmartDecorationLOD(),g=sandstone(),m=textured();
 g.computeBoundingSphere();const factor=40/g.boundingSphere.radius;
 const mesh=new THREE.InstancedMesh(g,m,2),matrix=new THREE.Matrix4().makeScale(factor,factor,factor);
 mesh.setMatrixAt(0,matrix);mesh.setMatrixAt(1,new THREE.Matrix4().makeTranslation(500,0,0).multiply(matrix));
 const matrices=mesh.instanceMatrix.array.slice(),camera=new THREE.OrthographicCamera(-480,480,480,-480,10,12000);
 mesh.castShadow=true;assert.equal(lod.register(mesh),true);
 camera.zoom=.5;lod.update(camera,900,0);
 assert.ok(lod.entries[0].level>0);assert.equal(mesh.material,m);assert.equal(mesh.count,2);
 assert.deepEqual(mesh.instanceMatrix.array,matrices);
 const level=lod.entries[0].level;camera.position.z=5000;lod.update(camera,900,250);
 assert.equal(lod.entries[0].level,level,'dolly distance must not affect orthographic LOD');
 camera.zoom=4;lod.update(camera,900,500);assert.equal(mesh.geometry,g);
 lod.setEnabled(false);camera.zoom=.1;lod.update(camera,900,750);assert.equal(mesh.geometry,g);
 lod.dispose();assert.equal(mesh.geometry,g);assert.equal(mesh.castShadow,true);
 assert.equal(decorationLodLevel(60,0),0);assert.equal(decorationLodLevel(60,1),1);
 assert.equal(decorationLodLevel(34,2),2);assert.equal(decorationLodLevel(38,2),1);
});

test('visible LOD materials require full PBR; no new textures or flat replacement materials',()=>{
 const lod=new SmartDecorationLOD(),g=sandstone(),m=textured();
 const invalid=new THREE.InstancedMesh(g,new THREE.MeshStandardMaterial({color:'brown'}),1);
 assert.equal(lod.register(invalid),false);
 const mesh=new THREE.InstancedMesh(g,m,1);mesh.setMatrixAt(0,new THREE.Matrix4());
 assert.equal(lod.register(mesh),true);
 for(const level of lod.entries[0].levels){
  assert.ok(level.attributes.uv&&level.attributes.normal);
  assert.ok(mesh.material.map&&mesh.material.normalMap&&mesh.material.roughnessMap);
  assert.equal(mesh.material.map.colorSpace,THREE.SRGBColorSpace);
 }
 lod.dispose();
});

test('explicit bloom marking leaves bright building shells and HUD outside the mask',()=>{
 const root=new THREE.Group(),shell=new THREE.Mesh(new THREE.BoxGeometry(),textured());
 shell.name='SF_EnergyCore_PBR_Housing';const light=shell.clone();light.name='SF_EnergyCore_PBR_energy';
 const beacon=shell.clone();beacon.name='BastionStatic_beacon';
 root.add(shell,light,beacon);markTechnicalGlow(root);
 assert.equal(shell.layers.isEnabled(BLOOM_LAYER),false);assert.equal(light.layers.isEnabled(BLOOM_LAYER),true);
 assert.equal(beacon.layers.isEnabled(BLOOM_LAYER),true);
 assert.equal(shell.material,light.material,'bloom marking must never clone or repaint PBR materials');
});

test('post targets persist at equal sizes and direct bypass does not allocate targets',()=>{
 let renders=0,w=1280,h=720;
 const renderer={getDrawingBufferSize:v=>v.set(w,h),render:()=>renders++};
 const post=new SandforgeVisualPost(renderer,{enabled:false});
 post.render({},{});assert.equal(renders,1);assert.equal(post.targets,null);
 post.ensureSize();const targets=post.targets;post.ensureSize();assert.equal(post.targets,targets);
 assert.equal(targets.main.depthTexture,targets.mask.depthTexture);
 assert.equal(targets.main.texture.colorSpace,THREE.LinearSRGBColorSpace);
 assert.equal(targets.a.width,320);w=640;h=480;post.ensureSize();assert.equal(post.targets,targets);
 assert.equal(targets.a.width,160);post.dispose();
});

test('post light mask retains scene depth and restores camera and renderer state even on failure',()=>{
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,1,100);
 const originalBackground=new THREE.Color('#000000');scene.background=originalBackground;
 let target=null,draws=0,depthCleared=false;
 const renderer={autoClear:true,shadowMap:{autoUpdate:true},
  getDrawingBufferSize:v=>v.set(800,600),setRenderTarget:t=>{target=t;},
  clear:(_color,depth)=>{depthCleared=depth;},
  render:(s,c)=>{draws++;if(draws===2){assert.equal(c.layers.mask,1<<BLOOM_LAYER);throw Error('test target failure');}}};
 const post=new SandforgeVisualPost(renderer),warn=console.warn;console.warn=()=>{};
 try{post.render(scene,camera);}finally{console.warn=warn;}
 assert.equal(post.failed,true);assert.equal(draws,3,'a failed post frame must fall back to the direct scene');
 assert.equal(depthCleared,false);assert.equal(camera.layers.mask,1);assert.equal(scene.background,originalBackground);
 assert.equal(renderer.autoClear,true);assert.equal(renderer.shadowMap.autoUpdate,true);assert.equal(target,null);
 post.dispose();
});
