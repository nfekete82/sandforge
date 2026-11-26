import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {factionFlagTexture,FACTION_FLAG_COLORS,FACTION_FLAG_REVISION,unifyModelFactionFlags}
 from '../scripts/webgl-faction-flags.js';
import {FACTION_BLUE,FACTION_RED} from '../scripts/sandforge-faction-palette.js';
import {createFortifiedBunker,BUNKER_VISUAL_SCALE,BUNKER_VISUAL_PORT_COUNT}
 from '../scripts/webgl-fortified-bunker.js';
import {SandforgeProductionGates} from '../scripts/webgl-production-gates.js';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';

test('all blue/red cloth flags have the same five-point pure-white star',()=>{
 assert.deepEqual(FACTION_FLAG_COLORS,{0:FACTION_BLUE,1:FACTION_RED});
 for(const team of [0,1]){
  const map=factionFlagTexture(team),again=factionFlagTexture(team);
  assert.equal(map,again,'one shared texture per faction');
  assert.equal(map.colorSpace,THREE.SRGBColorSpace);
  assert.equal(map.userData.revision,FACTION_FLAG_REVISION);
  assert.equal(map.image.width,256);assert.equal(map.image.height,128);
  const pixel=(x,y)=>[...map.image.data.slice((y*256+x)*4,(y*256+x)*4+3)];
  assert.deepEqual(pixel(135,64),[255,255,255],'five-point star center must be exactly white');
  const background=pixel(25,25);
  if(team===0)assert.ok(background[2]>background[0]);
  else assert.ok(background[0]>background[2]);
  const whiteCount=Array.from({length:128*256},(_,i)=>{
   const k=i*4,d=map.image.data;return d[k]>=245&&d[k+1]>=245&&d[k+2]>=245;
  }).filter(Boolean).length;
  assert.ok(whiteCount>750&&whiteCount<6500,'large but balanced 5-point emblem');
 }
 assert.notEqual(factionFlagTexture(0),factionFlagTexture(1));
});
test('both faction bunkers are 28 percent smaller but preserve five ports and original physics',()=>{
 assert.equal(BUNKER_VISUAL_SCALE,.72);
 assert.equal(BUILDINGS.bunker.width,155);
 assert.equal(BUILDINGS.bunker.radius,54);
 const root0=createFortifiedBunker(0),root1=createFortifiedBunker(1);
 for(const [owner,root] of [[0,root0],[1,root1]]){
  assert.equal(root.scale.x,.72);assert.equal(root.scale.y,.72);
  assert.equal(root.scale.z,.72);
  assert.equal(root.userData.bunkerFiringPorts,5);
  assert.equal(BUNKER_VISUAL_PORT_COUNT,5);
  const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3());
  assert.ok(size.x<120&&size.z<120,'bunker is not the old oversized shell');
  assert.ok(size.y<80,'roof antenna shrinks with bunker, too');
  const flag=root.children.find(o=>o.userData?.bunkerFlag);
  assert.ok(flag);
  assert.equal(flag.material.map,factionFlagTexture(owner));
  for(const i of [1,2,3,7,8])assert.ok(root.getObjectByName('Bunker_Embrasure_'+i));
 }
 assert.equal(BUILDINGS.bunker.hp,1500);
});
test('authored GLB cloth flag receives central white-star design; changes owner safely',()=>{
 const root=new THREE.Group(),pole=new THREE.Mesh(new THREE.BoxGeometry(1,10,1),
  new THREE.MeshStandardMaterial({name:'steel'}));
 pole.name='BastionFlagMast';root.add(pole);
 const fabric=new THREE.Mesh(new THREE.PlaneGeometry(8,5),
  new THREE.MeshStandardMaterial({name:'Bastion_fabric',color:'green'}));
 fabric.name='Bastion_Flag_Fabric';root.add(fabric);
 assert.equal(unifyModelFactionFlags(root,0),1);
 assert.equal(fabric.material.map,factionFlagTexture(0));
 assert.equal(unifyModelFactionFlags(root,0),0);
 assert.equal(unifyModelFactionFlags(root,1),1);
 assert.equal(fabric.material.map,factionFlagTexture(1));
 assert.equal(pole.material.name,'steel');
});
const temp=mkdtempSync(join(tmpdir(),'sandforge-open-factory-'));
const glbDocs=new Map();
try{
 execFileSync(process.execPath,['scripts/generate-factory-pbr.mjs',temp],
  {cwd:process.cwd(),timeout:90000,stdio:'pipe'});
 for(const team of [0,1]){
  const raw=readFileSync(join(temp,'factory-'+team+'.glb'));
  const len=raw.readUInt32LE(12);
  glbDocs.set(team,{raw,doc:JSON.parse(raw.toString('utf8',20,20+len)),
   binStart:28+len});
 }
}finally{
 rmSync(temp,{recursive:true,force:true});
}
for(const team of [0,1])test('real generated factory-'+team+' has a single independent shutter and clear opening',()=>{
 const {raw,doc,binStart}=glbDocs.get(team);
 assert.equal(doc.asset.generator,'factory-three-bay-sawtooth-pbr-20261121');
 const names=new Set(doc.nodes.map(n=>n.name));
 assert.equal(doc.nodes.filter(n=>n.name==='FactoryRollupDoor').length,1);
 assert.ok(!names.has('SF_Factory_PBR_OpenBay'));
 for(const part of ['roof','concrete','steel_dark','camo'])
  assert.ok(names.has('SF_Factory_PBR_'+part),part);
 assert.ok(raw.length<3_000_000);
 const findMesh=name=>doc.meshes[doc.nodes.find(n=>n.name===name).mesh];
 const positions=name=>{
  const accessor=doc.accessors[findMesh(name).primitives[0].attributes.POSITION];
  const start=binStart+doc.bufferViews[accessor.bufferView].byteOffset+(accessor.byteOffset??0);
  return Array.from({length:accessor.count},(_,i)=>[0,4,8].map(o=>raw.readFloatLE(start+i*12+o)));
 };
 const door=positions('FactoryRollupDoor');
 const left=Math.min(...door.map(([x])=>x)),right=Math.max(...door.map(([x])=>x));
 const fixedFacade=positions('SF_Factory_PBR_camo');
 assert.ok(fixedFacade.length>50);
 assert.ok(fixedFacade.every(([x,y,z])=>Math.abs(z-2.24)>.15||x<=left||x>=right||y>=1.71),
  'the authored walls leave the actual door opening clear');
 const roof=positions('SF_Factory_PBR_roof');
 assert.ok(Math.max(...roof.map(([x])=>x))-Math.min(...roof.map(([x])=>x))>5.5);
 assert.ok(doc.materials.every(m=>m.pbrMetallicRoughness?.baseColorTexture));
 assert.equal(BUILDINGS.factory.width,200);
 assert.equal(BUILDINGS.factory.radius,70);
});
for(const owner of [0,1])test('actual open factory drive-out '+owner+' starts without a shutter delay and preserves paid order',()=>{
 const base={id:123,owner,kind:'factory',x:500,y:500,facing:0,hp:1100,buildRemaining:0};
 const unit={id:65,owner,kind:'tank',x:610,y:620,hp:1000,angle:Math.PI/2,fire:0,
  orders:[{kind:'move',x:800,y:850}]};
 const game={time:10,bases:[base],units:[unit],productionReleases:[],
  stageWebGLProduction:true,extendProductionDeparture:()=>{},
  cancelProductionDeparture:id=>cancelled.push(id)};
 const cancelled=[],entryNode=new THREE.Group(),detail=new THREE.Group();
 const marker=new THREE.Group();marker.name='SF_Factory_PBR_OpenBay';
 detail.add(marker);detail.scale.setScalar(35);entryNode.add(detail);
 const actor={node:new THREE.Group()};
 const bf={game,bases:new Map([[123,{kind:'factory',node:entryNode,detail}]]),
  units:new Map([[65,actor]]),world:{size:1000,walkable:()=>true},
  heightAt:()=>0,entityPosition:u=>new THREE.Vector3(u.x-500,0,u.y-500),
  sound:{productionGate(){throw Error('NO SHUTTER SOUND FOR OPEN FACTORY');}}};
 const presenter=new SandforgeProductionGates(bf);
 const prior=JSON.stringify(unit);
 game.productionReleases.push({baseId:123,unitId:65,at:10,kind:'tank',owner});
 presenter.update(true,1);
 const gate=bf.bases.get(123).gate;
 assert.ok(gate?.openBay);
 assert.equal(gate.door,null);
 assert.equal(gate.hall,null);
 assert.equal(actor.node.visible,true,'vehicle visible immediately, without opening warning');
 const state=presenter.active.get(base.id);
 assert.ok(state?.duration>0);
 assert.equal(state.openBay,true);
 const start=actor.node.position.clone();
 game.time=10+state.duration*.35;
 presenter.update(true,1);
 assert.ok(actor.node.position.distanceTo(start)>1,'real unit visibly drives across factory floor');
 game.time=10+state.duration;
 presenter.update(true,1);
 assert.ok(actor.node.position.distanceTo(bf.entityPosition(unit))<.001);
 assert.ok(cancelled.includes(unit.id),'paid rally released without extra closure delay');
 assert.equal(JSON.stringify(unit),prior,'no game simulation state mutated');
 presenter.dispose();
});
