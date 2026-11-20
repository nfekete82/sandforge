import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {prepareMeshyFactory,MESHY_FACTORY_VERSION} from '../scripts/prepare-meshy-factory.mjs';
import {paintMeshyFactoryTeam,meshyFactoryPortal,MESHY_FACTORY_TEAM_REVISION}
 from '../scripts/webgl-meshy-factory-team.js';
import {SandforgeProductionGates,productionGatePose,GATE_TIMING}
 from '../scripts/webgl-production-gates.js';

const src='src/assets/reborn/buildings-3d/factory-meshy-optimized.glb';
function parse(path){
 const b=readFileSync(path);
 assert.equal(b.toString('ascii',0,4),'glTF');
 assert.equal(b.readUInt32LE(8),b.length);
 const len=b.readUInt32LE(12),doc=JSON.parse(b.toString('utf8',20,20+len));
 const start=28+len;
 return {b,doc,binStart:start};
}
function imageHash(glb,image){
 const view=glb.doc.bufferViews[image.bufferView],start=glb.binStart+view.byteOffset;
 return createHash('sha256').update(glb.b.subarray(start,start+view.byteLength)).digest('hex');
}
test('actual Meshy PBR shutter becomes a separate GLB node, leaving a real hole and exact original textures',()=>{
 const tmp=mkdtempSync(join(tmpdir(),'sf-meshy-live-'));
 try{
  const a=prepareMeshyFactory(src,tmp);
  assert.equal(a.status,'ready');assert.equal(a.output.length,2);
  const original=parse(src);
  const originalHashes=original.doc.images.map(img=>imageHash(original,img));
  const sourcePrimitive=original.doc.meshes[0].primitives[0];
  const sourceCount=original.doc.accessors[sourcePrimitive.indices].count/3;
  for(const owner of [0,1]){
   const {file,realDoorTriangles,intactFactoryTriangles}=a.output[owner];
   const output=parse(file),doc=output.doc;
   assert.equal(doc.asset.generator,MESHY_FACTORY_VERSION);
   assert.equal(realDoorTriangles,737);
   assert.equal(realDoorTriangles+intactFactoryTriangles,sourceCount);
   assert.ok(output.b.length<6_000_000);
   assert.deepEqual(doc.images.map(img=>imageHash(output,img)),originalHashes,
    'all Meshy source WebP PBR images remain byte for byte identical');
   const door=doc.nodes.find(n=>n.name==='FactoryRollupDoor');
   assert.ok(door?.mesh!==undefined);
   assert.ok(door.extras.realMeshyShutter);
   assert.equal(doc.accessors[doc.meshes[door.mesh].primitives[0].indices].count/3,737);
   assert.ok(doc.nodes.some(n=>n.name==='SF_Factory_Meshy_RolloutStart'));
   assert.ok(doc.nodes.some(n=>n.name==='SF_Factory_Meshy_RolloutExit'));
   const rig=doc.nodes.find(n=>n.name==='SF_Factory_Meshy_ProductionRig');
   assert.ok(rig&&Math.abs(rig.rotation[1]-Math.SQRT1_2)<1e-7);
   assert.equal(doc.asset.extras.owner,owner);
   assert.equal(doc.meshes[0].primitives[0].material,
    doc.meshes[door.mesh].primitives[0].material);
   assert.ok(doc.materials[0].normalTexture);
   assert.ok(doc.materials[0].pbrMetallicRoughness.metallicRoughnessTexture);
  }
 }finally{rmSync(tmp,{recursive:true,force:true});}
});
test('blue PBR original remains unchanged; red adjusts only paint accents in glTF fragment shader',()=>{
 const make=()=>{
  const group=new THREE.Group(),rig=new THREE.Group();
  rig.name='SF_Factory_Meshy_ProductionRig';group.add(rig);
  const map=new THREE.DataTexture(new Uint8Array([20,80,160,255]),1,1);
  const normal=new THREE.DataTexture(new Uint8Array([128,128,255,255]),1,1);
  const rough=new THREE.DataTexture(new Uint8Array([255,190,100,255]),1,1);
  const m=new THREE.MeshStandardMaterial({map,normalMap:normal,
   roughnessMap:rough,metalnessMap:rough,roughness:.83,metalness:.6});
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),m);
  rig.add(mesh);return {group,mesh,old:m,map,normal,rough};
 };
 const blue=make();assert.equal(paintMeshyFactoryTeam(blue.group,0),0);
 assert.equal(blue.mesh.material,blue.old);
 assert.equal(blue.mesh.material.map,blue.map);
 const red=make();assert.equal(paintMeshyFactoryTeam(red.group,1),1);
 assert.equal(red.mesh.material.map,red.map);
 assert.equal(red.mesh.material.normalMap,red.normal);
 assert.equal(red.mesh.material.roughnessMap,red.rough);
 assert.equal(red.mesh.material.metalnessMap,red.rough);
 assert.ok(red.mesh.material.userData.sandforgeMeshyFactionOwned);
 assert.equal(paintMeshyFactoryTeam(red.group,1),0,'no second repaint/shader pass');
 const shader={fragmentShader:'#include <map_fragment>',vertexShader:'',uniforms:{}};
 red.mesh.material.onBeforeCompile(shader);
 assert.match(shader.fragmentShader,/sfBlue/);
 assert.match(shader.fragmentShader,/sfRed/);
 assert.equal(red.mesh.material.userData.sandforgeMeshyTeamPaintRevision,
  MESHY_FACTORY_TEAM_REVISION);
});
test('actual Meshy 3D door rolls upward and serializes paid factory rollout without changing Simulation',()=>{
 const base={id:400,kind:'factory',owner:0,x:500,y:500,facing:0,hp:1100,
  buildRemaining:0,radius:70};
 const unit={id:95,owner:0,kind:'tank',x:640,y:700,angle:0,
  hp:1000,fire:0,orders:[{kind:'move',x:780,y:920}]};
 const game={time:10,bases:[base],units:[unit],productionReleases:[],
  stageWebGLProduction:true,extendProductionDeparture(){},
  cancelProductionDeparture(id){released.push(id);},obstacles(){return [];}};
 const released=[],node=new THREE.Group(),detail=new THREE.Group();
 const rig=new THREE.Group();rig.name='SF_Factory_Meshy_ProductionRig';
 detail.add(rig);node.add(detail);
 const door=new THREE.Mesh(new THREE.BoxGeometry(.5,.3,.018),
  new THREE.MeshStandardMaterial());door.name='FactoryRollupDoor';
 door.position.y=-.404;door.scale.y=.000116;
 rig.add(door);
 for(const [name,p] of [
  ['SF_Factory_Meshy_RolloutStart',[-.425,-.292,.16]],
  ['SF_Factory_Meshy_RolloutExit',[-.425,-.345,.74]]]){
  const marker=new THREE.Group();marker.name=name;marker.position.set(...p);rig.add(marker);
 }
 const actor={node:new THREE.Group()};
 const bf={game,bases:new Map([[400,{kind:'factory',owner:0,node,detail}]]),
  units:new Map([[95,actor]]),world:{size:1000,walkable(){return true;}},
  heightAt(){return 0;},entityPosition(u){return new THREE.Vector3(u.x-500,0,u.y-500)},
  sound:{productionGate(){}}};
 const presenter=new SandforgeProductionGates(bf),old=JSON.stringify(unit);
 game.productionReleases.push({baseId:400,unitId:95,kind:'tank',owner:0,at:10});
 presenter.update(true,1);
 const gate=bf.bases.get(400).gate;
 assert.ok(gate?.meshyShutter);
 assert.equal(gate.doorClosedY,-.404);
 assert.equal(gate.doorScaleY,.000116);
 assert.equal(actor.node.visible,false);
 assert.equal(presenter.active.size,1);
 assert.equal(presenter.active.get(400).openBay,false);
 game.time=10+GATE_TIMING.warning+GATE_TIMING.opening*.5;
 presenter.update(true,1);
 assert.ok(door.position.y>-.404&&door.position.y<-.074);
 assert.ok(door.scale.y<.000116);
 assert.equal(actor.node.visible,true);
 game.time=10+GATE_TIMING.warning+GATE_TIMING.opening;
 presenter.update(true,1);
 assert.ok(door.position.y>-.085,'door must roll high enough for exiting vehicle');
 const duration=presenter.active.get(400).duration;
 game.time=10+GATE_TIMING.warning+GATE_TIMING.opening+duration*.5;
 presenter.update(true,1);
 assert.ok(actor.productionMotion?.moving);
 game.time=10+GATE_TIMING.warning+GATE_TIMING.opening+duration;
 presenter.update(true,1);
 assert.ok(released.includes(unit.id));
 game.time+=GATE_TIMING.closing+.12;
 presenter.update(true,1);
 assert.equal(presenter.active.size,0);
 assert.equal(door.position.y,-.404);
 assert.equal(door.scale.y,.000116);
 assert.equal(JSON.stringify(unit),old,'no game-state or original rally mutation');
 presenter.dispose();
});
